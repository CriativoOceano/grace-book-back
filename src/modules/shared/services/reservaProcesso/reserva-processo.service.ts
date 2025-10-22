import {
  Injectable,
  Inject,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { IPagamentoRepository } from 'src/modules/pagamentos/repositories/interfaces/pagamento-repository.interface';
import { CreateReservaDto } from 'src/modules/reservas/DTO/create-reserva.dto';
import { IReservaRepository } from 'src/modules/reservas/repositories/interfaces/reserva-repository.interface';
import { PAGAMENTO_REPOSITORY } from 'src/modules/pagamentos/repositories/pagamento-repository.provider';
import { RESERVA_REPOSITORY } from 'src/modules/reservas/repositories/reserva-repository.provider';
import { PagamentosService } from 'src/modules/pagamentos/pagamentos.service';
import { StatusPagamento } from 'src/modules/pagamentos/pagamento.enums';
import { StatusReserva } from 'src/modules/reservas/reserva.enums';
import { CONFIGURACOES_REPOSITORY } from 'src/modules/configuracoes/repositories/configuracaoes-repository.provider';
import { IConfiguracoesRepository } from 'src/modules/configuracoes/repositories/interfaces/reserva-repository.interface';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { IDadosPagamento } from 'src/modules/pagamentos/interfaces/dados-pagamento.interface';
import { CalculoReservaService } from './calcular-reserva.service';

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

    private readonly pagamentoService: PagamentosService,

    private readonly calculoReservaService: CalculoReservaService

  ) {}

  async processarNovaReserva(dadosReserva: CreateReservaDto) {
    dadosReserva.quantidadeDiarias = await this.getQtdDias(
      dadosReserva.dataInicio,
      dadosReserva.dataFim,
    );

    const reserva = await this.reservaRepository.createReserva(dadosReserva);

    const pagamento = await this.pagamentoService.criarCobranca(reserva['_id'].toString(), dadosReserva.dadosPagamento);

    await this.reservaRepository.updateReserva(reserva['_id'].toString(), { pagamento: pagamento });

    return { reserva, pagamento };
  }

  async processarCancelamentoReserva(reservaId: string, motivo: string) {
    const pagamentos =
      await this.pagamentoRepository.findByReservaId(reservaId);

    for (const pagamento of pagamentos) {
      await this.pagamentoService.cancelarCobranca(reservaId);
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
        dadosPagamento
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
}
