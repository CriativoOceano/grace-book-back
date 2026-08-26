import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPagamentoRepository } from 'src/modules/pagamentos/repositories/interfaces/pagamento-repository.interface';
import { CreateReservaDto } from 'src/modules/reservas/DTO/create-reserva.dto';
import { IReservaRepository } from 'src/modules/reservas/repositories/interfaces/reserva-repository.interface';
import { PAGAMENTO_REPOSITORY } from 'src/modules/pagamentos/repositories/pagamento-repository.provider';
import { RESERVA_REPOSITORY } from 'src/modules/reservas/repositories/reserva-repository.provider';
import { PagamentosService } from 'src/modules/pagamentos/pagamentos.service';
import { StatusPagamento } from 'src/modules/pagamentos/pagamento.enums';
import { StatusReserva, TipoReserva } from 'src/modules/reservas/reserva.enums';
import { CONFIGURACOES_REPOSITORY } from 'src/modules/configuracoes/repositories/configuracaoes-repository.provider';
import { IConfiguracoesRepository } from 'src/modules/configuracoes/repositories/interfaces/reserva-repository.interface';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { IDadosPagamento } from 'src/modules/pagamentos/interfaces/dados-pagamento.interface';
import { CalculoReservaService } from './calcular-reserva.service';
import {
  ReservaHold,
  ReservaHoldDocument,
} from 'src/schemas/reserva-hold.schema';

@Injectable()
export class ReservaProcessoService {
  constructor(
    @Inject(RESERVA_REPOSITORY)
    private readonly reservaRepository: IReservaRepository,

    @Inject(PAGAMENTO_REPOSITORY)
    private readonly pagamentoRepository: IPagamentoRepository,

    @Inject(CONFIGURACOES_REPOSITORY)
    private readonly configuracoesRepository: IConfiguracoesRepository,

    @InjectConnection() private readonly connection: Connection,

    @InjectModel(ReservaHold.name)
    private readonly reservaHoldModel: Model<ReservaHoldDocument>,

    private readonly pagamentoService: PagamentosService,

    private readonly calculoReservaService: CalculoReservaService,
  ) {}

  /**
   * Cria uma trava atômica por diária/recurso para a reserva.
   * O índice único {data, recurso} do ReservaHold faz o MongoDB rejeitar
   * (E11000) uma segunda reserva concorrente para a mesma noite, mesmo que
   * ambas tenham passado pela checagem de disponibilidade por leitura.
   * Deve ser chamado dentro da mesma sessão/transação da criação da reserva:
   * se falhar, a reserva inteira é revertida junto.
   */
  private async criarHoldsDeReserva(
    session: any,
    reservaId: any,
    tipo: TipoReserva,
    dataInicio: Date,
    quantidadeDiarias: number,
    quantidadeChales: number,
  ): Promise<void> {
    const noites: Date[] = [];
    const cursor = new Date(dataInicio);
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < Math.max(1, quantidadeDiarias || 1); i++) {
      noites.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const holds: { data: Date; recurso: string; reservaId: any }[] = [];

    // Diária, batismo e o pacote completo disputam o mesmo slot da propriedade.
    if (
      tipo === TipoReserva.DIARIA ||
      tipo === TipoReserva.BATISMO ||
      tipo === TipoReserva.COMPLETO
    ) {
      for (const noite of noites) {
        holds.push({ data: noite, recurso: 'principal', reservaId });
      }
    }

    // Chalés: reserva N unidades numeradas (1-4) livres em cada noite.
    if (quantidadeChales && quantidadeChales > 0) {
      for (const noite of noites) {
        const ocupados = await this.reservaHoldModel
          .find({ data: noite, recurso: { $regex: /^chale-/ } }, { recurso: 1 })
          .session(session)
          .lean();
        const numerosOcupados = new Set(
          ocupados.map((h: any) => Number(String(h.recurso).split('-')[1])),
        );
        const livres: number[] = [];
        for (let n = 1; n <= 4 && livres.length < quantidadeChales; n++) {
          if (!numerosOcupados.has(n)) livres.push(n);
        }
        if (livres.length < quantidadeChales) {
          throw new ConflictException(
            'Não há chalés suficientes disponíveis para uma ou mais datas selecionadas. Tente outro período ou reduza a quantidade de chalés.',
          );
        }
        for (const n of livres) {
          holds.push({ data: noite, recurso: `chale-${n}`, reservaId });
        }
      }
    }

    if (holds.length === 0) return;

    try {
      await this.reservaHoldModel.insertMany(holds, { session, ordered: true });
    } catch (error) {
      if (error?.code === 11000) {
        throw new ConflictException(
          'Uma ou mais datas selecionadas foram reservadas por outra pessoa nos últimos instantes. Por favor, escolha outro período.',
        );
      }
      throw error;
    }
  }

  /**
   * Libera as travas de diária de uma reserva (usado em cancelamento).
   */
  async liberarHoldsDeReserva(reservaId: any, session?: any): Promise<void> {
    await this.reservaHoldModel.deleteMany({ reservaId }, { session });
  }

  async processarNovaReserva(dadosReserva: CreateReservaDto, session?: any) {
    dadosReserva.quantidadeDiarias = await this.getQtdDias(
      dadosReserva.dataInicio,
      dadosReserva.dataFim,
    );

    const reserva = await this.reservaRepository.createReserva(dadosReserva, {
      session,
    });

    // Trava atômica: se outra reserva concorrente já ocupou uma das noites,
    // isso lança ConflictException e reverte a transação inteira.
    await this.criarHoldsDeReserva(
      session,
      reserva['_id'],
      dadosReserva.tipo as TipoReserva,
      new Date(dadosReserva.dataInicio),
      dadosReserva.quantidadeDiarias,
      dadosReserva.quantidadeChales || 0,
    );

    // notificarPorEmail=false: reservar.service.ts já envia o e-mail
    // completo de "reserva criada" (com o link de pagamento) logo em
    // seguida; sem isso o cliente recebia dois e-mails de pagamento
    // pendente para o mesmo evento.
    const pagamento = await this.pagamentoService.criarCobranca(
      reserva['_id'].toString(),
      dadosReserva.dadosPagamento,
      session,
      false,
    );

    await this.reservaRepository.updateReserva(
      reserva['_id'].toString(),
      { pagamento: pagamento },
      { session },
    );

    return { reserva, pagamento };
  }

  async processarCancelamentoReserva(reservaId: string, motivo: string) {
    const pagamentos =
      await this.pagamentoRepository.findByReservaId(reservaId);

    for (const pagamento of pagamentos) {
      await this.pagamentoService.cancelarCheckoutPendente(reservaId);
      await this.pagamentoRepository.updatePagamento(
        pagamento['_id'].toString(),
        {
          status: StatusPagamento.CANCELADO,
        },
      );
    }
    const reservaCancelada = await this.reservaRepository.updateReserva(
      reservaId,
      {
        historico: [
          ...(await this.reservaRepository.getHistorico(reservaId)),
          {
            data: new Date(),
            status: StatusReserva.CANCELADA,
            observacao: motivo,
          },
        ],
        statusReserva: StatusReserva.CANCELADA,
      },
    );

    // Liberar as diárias travadas para que voltem a ficar disponíveis
    await this.liberarHoldsDeReserva(reservaId);

    return reservaCancelada;
  }

  async getConfiguracoes(): Promise<any> {
    return this.configuracoesRepository.findAll();
  }

  async getReservaById(reservaId: string): Promise<any> {
    return this.reservaRepository.findById(reservaId);
  }

  async getReservaByCodigo(codigo: string): Promise<any> {
    return this.reservaRepository.findByCodigo(codigo);
  }

  async getPagamentosByReservaId(reservaId: string): Promise<any> {
    return await this.pagamentoRepository.findByReservaId(reservaId);
  }

  async retentarGeracaoCheckout(
    reservaId: string,
    dadosPagamento: IDadosPagamento,
  ) {
    // Verificar se a reserva existe
    const reserva = await this.reservaRepository.findById(reservaId);

    if (!reserva) {
      throw new NotFoundException('Reserva não encontrada');
    }

    // Iniciar uma sessão de transação
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Gerar um novo link de checkout
      const novoCheckout = await this.pagamentoService.criarCobranca(
        reservaId,
        dadosPagamento,
        session,
      );

      // Atualizar a reserva com o novo link
      await this.reservaRepository.updateReserva(
        reservaId,
        {
          pagamento: novoCheckout,
          statusReserva: StatusReserva.PENDENTE,
        },
        { session },
      );

      // Confirmar a transação
      await session.commitTransaction();

      return {
        mensagem: 'Novo link de pagamento gerado com sucesso',
        linkPagamento: novoCheckout.linkPagamento,
      };
    } catch (error) {
      // Reverter a transação em caso de erro
      await session.abortTransaction();

      throw new HttpException(
        'Falha ao gerar novo link de pagamento. Por favor, tente novamente mais tarde.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      session.endSession();
    }
  }

  async getQtdDias(dataInicio: Date, dataFim: Date): Promise<number> {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diferencaMS = fim.getTime() - inicio.getTime();
    const diferencaDias = Math.max(
      1,
      Math.ceil(diferencaMS / (1000 * 60 * 60 * 24)),
    );
    return diferencaDias;
  }

  /**
   * Processar estorno de pagamento
   */
  async processarEstornoPagamento(
    pagamentoId: string,
    valor?: number,
    descricao?: string,
  ): Promise<any> {
    return this.pagamentoService.processarEstornoPagamento(
      pagamentoId,
      valor,
      descricao,
    );
  }
}
