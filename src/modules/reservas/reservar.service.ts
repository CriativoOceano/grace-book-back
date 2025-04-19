import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VerificarDisponibilidadeDto } from './dto/verificar-disponibilidade.dto';
import { Reserva, ReservaModel } from 'src/schemas/reserva.schema';
import { ReservaRepository } from './repositories/reserva.repository';
import { ReservaProcessoService } from 'src/modules/shared/services/reservaProcesso/reserva-processo.service';
import { StatusPagamento } from '../pagamentos/pagamento.enums';
import { StatusReserva, TipoReserva } from './reserva.enums';
import { EmailsService } from '../emails/email.service';
import { CalculoReservaService } from '../shared/services/reservaProcesso/calcular-reserva.service';
import { ConfiguracoesRepository } from '../configuracoes/repositories/configuracoes.repository';

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: ReservaModel,
    private readonly usuariosService: UsuariosService,
    private readonly emailsService: EmailsService,
    private readonly reservaProcessoService: ReservaProcessoService,
    private readonly calculoReservaService: CalculoReservaService,
  ) {}

  async create(
    createReservaDto: CreateReservaDto,
    userId: string,
  ): Promise<{ reserva: Reserva; pagamento: any }> {
    try {
      // Buscar usuário
      const usuario = await this.usuariosService.findById(userId);
      // Verificar disponibilidade
      const disponibilidade = await this.verificarDisponibilidade({
        dataInicio: createReservaDto.dataInicio,
        dataFim: createReservaDto.dataFim,
        tipo: createReservaDto.tipo,
        quantidadeChales: createReservaDto.quantidadeChales,
      });

      if (!disponibilidade) {
        throw new BadRequestException(
          'Não há disponibilidade para esta data ou quantidade de chalés',
        );
      }

      if (!disponibilidade) {
        // Mensagens específicas para cada caso de indisponibilidade
        if (createReservaDto.tipo === TipoReserva.BATISMO) {
          throw new HttpException(
            'Já existe uma reserva agendada para esta data',
            HttpStatus.CONFLICT,
          );
        } else if (createReservaDto.tipo === TipoReserva.DIARIA) {
          throw new HttpException(
            'Já existe uma diária reservada para este período',
            HttpStatus.CONFLICT,
          );
        } else {
          throw new HttpException(
            'O período solicitado não está disponível para este tipo de reserva',
            HttpStatus.CONFLICT,
          );
        }
      }
      // Gerar código único para a reserva
      const codigo = await this.reservaModel.gerarCodigoReserva();

      // Gerar código de acesso
      const codigoAcesso = this.reservaModel.gerarCodigoAcesso();

      createReservaDto.quantidadeDiarias = await this.getQtdDias(
        createReservaDto.dataInicio,
        createReservaDto.dataFim || createReservaDto.dataInicio,
      );
      // Calcular valor da reserva
      const valorTotaldaReserva =
        await this.calculoReservaService.getValorReserva(createReservaDto);

      // Criar reserva
      const novaReserva = {
        codigo,
        codigoAcesso,
        usuario: usuario,
        usuarioEmail: usuario.email,
        usuarioNome: usuario.nome,
        tipo: createReservaDto.tipo,
        dataInicio: createReservaDto.dataInicio,
        dataFim: createReservaDto.dataFim || createReservaDto.dataInicio, // Se não informar dataFim, usa a mesma dataInicio
        quantidadePessoas: createReservaDto.quantidadePessoas,
        quantidadeChales: createReservaDto.quantidadeChales,
        quantidadeDiarias: await this.getQtdDias(
          createReservaDto.dataInicio,
          createReservaDto.dataFim || createReservaDto.dataInicio,
        ),
        observacoes: createReservaDto.observacoes,
        historico: [
          {
            data: new Date(),
            acao: 'Reserva criada',
            detalhes: 'Aguardando pagamento',
          },
        ],
        valorTotal: valorTotaldaReserva.valorTotal,
        dadosPagamento: createReservaDto.dadosPagamento,
        dataCriacao: new Date(),
        dataAtualizacao: new Date(),
      };

      console.log(novaReserva.usuario);
      const reservaCriada =
        await this.reservaProcessoService.processarNovaReserva(novaReserva);

      let reserva = reservaCriada.reserva;
      let pagamento = reservaCriada.pagamento;
      return { reserva, pagamento };
    } catch (error) {
      this.logger.error(`Erro ao criar reserva: ${error.message}`);
      throw error;
    }
  }

  // async update(
  //   id: string,
  //   updateReservaDto: UpdateReservaDto,
  //   userId: string,
  // ): Promise<Reserva> {
  //   // Buscar reserva
  //   const reserva = await this.reservaRepository.findById(id);

  //   // Verificar se o usuário é o dono da reserva ou um admin
  //   if (
  //     reserva.usuario.toString() !== userId &&
  //     !(await this.usuariosService.findById(userId)).isAdmin
  //   ) {
  //     throw new BadRequestException(
  //       'Você não tem permissão para atualizar esta reserva',
  //     );
  //   }

  //   // Verificar se a reserva pode ser atualizada (não cancelada ou já paga)
  //   if (reserva.pagamento.status === StatusPagamento.CANCELADO) {
  //     throw new BadRequestException(
  //       'Esta reserva foi cancelada e não pode ser atualizada',
  //     );
  //   }

  //   if (reserva.pagamento.status === StatusPagamento.PAGO) {
  //     throw new BadRequestException(
  //       'Esta reserva já foi paga e não pode ser atualizada',
  //     );
  //   }

  //   // Verificar disponibilidade se a data foi alterada
  //   if (
  //     updateReservaDto.dataInicio &&
  //     reserva.dataInicio.toISOString() !==
  //       new Date(updateReservaDto.dataInicio).toISOString()
  //   ) {
  //     const disponibilidade = await this.verificarDisponibilidade({
  //       data: updateReservaDto.dataInicio,
  //       tipo: updateReservaDto.tipo || reserva.tipo,
  //       quantidadeChales:
  //         updateReservaDto.quantidadeChales || reserva.quantidadeChales,
  //     });

  //     if (!disponibilidade.disponivel) {
  //       throw new BadRequestException(
  //         'Não há disponibilidade para esta data ou quantidade de chalés',
  //       );
  //     }
  //   }

  //   // Recalcular valor se algum parâmetro relevante foi alterado
  //   if (
  //     updateReservaDto.tipo ||
  //     updateReservaDto.quantidadePessoas ||
  //     updateReservaDto.quantidadeChales
  //   ) {
  //     const valorTotal = await this.cotarReserva(
  //       updateReservaDto.tipo || reserva.tipo,
  //       updateReservaDto.quantidadePessoas || reserva.quantidadePessoas,
  //       updateReservaDto.quantidadeChales || reserva.quantidadeChales,
  //     );

  //     reserva.valorTotal = valorTotal;
  //     reserva.pagamento.valorTotal = valorTotal;
  //   }

  //   // Atualizar campos
  //   if (updateReservaDto.tipo) reserva.tipo = updateReservaDto.tipo;
  //   if (updateReservaDto.dataInicio)
  //     reserva.dataInicio = new Date(updateReservaDto.dataInicio);
  //   if (updateReservaDto.dataFim)
  //     reserva.dataFim = new Date(updateReservaDto.dataFim);
  //   if (updateReservaDto.quantidadePessoas)
  //     reserva.quantidadePessoas = updateReservaDto.quantidadePessoas;
  //   if (updateReservaDto.quantidadeChales)
  //     reserva.quantidadeChales = updateReservaDto.quantidadeChales;
  //   if (updateReservaDto.observacoes)
  //     reserva.observacoes = updateReservaDto.observacoes;

  //   // Adicionar ao histórico
  //   reserva.historico.push({
  //     data: new Date(),
  //     acao: 'Reserva atualizada',
  //     detalhes: 'Detalhes da reserva foram atualizados',
  //   });

  //   // Salvar reserva
  //   return reserva.save();
  // }

  // async cancelar(id: string, userId: string, motivo: string) {
  //   const reserva = await this.reservaRepository.findById(id);
  //   if (!reserva) {
  //     throw new NotFoundException('Reserva não encontrada');
  //   }
  //   const pagamentos =
  //     await this.reservaProcessoService.getPagamentosByReservaId(id);
  //   if (!pagamentos) {
  //     throw new NotFoundException('Pagamentos não encontrados');
  //   }

  //   if (
  //     reserva.usuario['_id'].toString() !== userId &&
  //     !(await this.usuariosService.findById(userId)).isAdmin
  //   ) {
  //     throw new BadRequestException(
  //       'Você não tem permissão para cancelar esta reserva',
  //     );
  //   }
  //   if (reserva.statusReserva === StatusReserva.CANCELADA) {
  //     throw new BadRequestException('Esta reserva já foi cancelada');
  //   }

  //   for (const pagamento of pagamentos) {
  //     if (
  //       pagamento.status === StatusPagamento.PAGO &&
  //       !(await this.usuariosService.findById(userId)).isAdmin
  //     ) {
  //       throw new BadRequestException(
  //         'Esta reserva já foi paga e só pode ser cancelada por um administrador',
  //       );
  //     }
  //   }

  //   const reservaAtualizada = await this.reservaProcessoService.processarCancelamentoReserva(
  //     reserva._id.toString(),
  //     motivo
  //   );

  //   const usuario = await this.usuariosService.findById(
  //     reserva.usuario['_id'].toString(),
  //   );
  //   await this.emailsService.enviarNotificacaoPagamento(
  //     usuario.email,
  //     usuario.nome,
  //     reserva.codigo,
  //     'cancelado',
  //   );

  //   return reservaAtualizada;
  // }

  async verificarDisponibilidade(
    disponibilidadeDTO: VerificarDisponibilidadeDto,
  ): Promise<boolean> {
    // Para facilitar a comparação, vamos trabalhar só com as datas (sem horas)
    const inicioAjustado = new Date(disponibilidadeDTO.dataInicio);
    inicioAjustado.setHours(0, 0, 0, 0);

    const fimAjustado = new Date(disponibilidadeDTO.dataFim);
    fimAjustado.setHours(23, 59, 59, 999);

    // Critérios de busca base - períodos que se sobrepõem
    const filtroBase = {
      $or: [
        // Caso 1: A data de início da nova reserva está entre o início e fim de uma reserva existente
        {
          dataInicio: { $lte: inicioAjustado },
          dataFim: { $gte: inicioAjustado },
        },
        // Caso 2: A data de fim da nova reserva está entre o início e fim de uma reserva existente
        {
          dataInicio: { $lte: fimAjustado },
          dataFim: { $gte: fimAjustado },
        },
        // Caso 3: A nova reserva engloba completamente uma reserva existente
        {
          dataInicio: { $gte: inicioAjustado },
          dataFim: { $lte: fimAjustado },
        },
      ],
      // Considerar apenas reservas não canceladas
      statusReserva: { $ne: StatusReserva.CANCELADA },
    };

    switch (disponibilidadeDTO.tipo) {
      case TipoReserva.BATISMO:
        // Para batismo, não pode haver outro batismo no mesmo dia
        const reservasBatismo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.BATISMO,
        });

        if (reservasBatismo.length > 0) {
          return false; // Já existe batismo para o período
        }

        // Verificar se há diárias no período (que impedem o batismo)
        const diariasNoPeriodoBatismo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.DIARIA,
        });

        if (diariasNoPeriodoBatismo.length > 0) {
          return false; // Há diárias que impedem o batismo
        }

        return true;

      case TipoReserva.DIARIA:
        // Verificar se há batismos no período (que impedem diárias)
        const batismosNoPeriodo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.BATISMO,
        });

        if (batismosNoPeriodo.length > 0) {
          return false; // Há batismos que impedem a reserva de diária
        }

        // Verificar se já existe uma reserva de diária para o período
        // Como só pode haver uma diária por dia, verificamos se já existe alguma
        const diariasNoPeriodo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.DIARIA,
        });

        if (diariasNoPeriodo.length > 0) {
          return false; // Já existe diária para o período
        }

        // Se a reserva incluir chalés, verificar disponibilidade de chalés
        if (
          disponibilidadeDTO.quantidadeChales &&
          disponibilidadeDTO.quantidadeChales > 0
        ) {
          const config = await this.reservaProcessoService.getConfiguracoes();
          const maxChalesDisponiveis = config.qtdTotalChales || 10; // Default 10 se não configurado

          // Verificar se a quantidade solicitada excede o máximo disponível
          if (disponibilidadeDTO.quantidadeChales > maxChalesDisponiveis) {
            return false; // Quantidade de chalés solicitada excede o total disponível
          }
        }

        return true;

      default:
        throw new HttpException(
          `Tipo de reserva '${disponibilidadeDTO.tipo}' não reconhecido`,
          HttpStatus.BAD_REQUEST,
        );
    }
  }
  private obterDescricaoTipo(tipo: string): string {
    const tipos = {
      [TipoReserva.DIARIA]: 'Diária',
      [TipoReserva.CHALE]: 'Chalé(s)',
      [TipoReserva.BATISMO]: 'Cerimônia de Batismo',
      [TipoReserva.COMPLETO]: 'Pacote Completo (Diária + Chalés)',
    };

    return tipos[tipo] || tipo;
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
