import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { UsuariosService } from '../usuarios/usuarios.service';
import { EmailsService } from '../emails/email.service';
import { StatusPagamento } from 'src/schemas/reserva.schema';
import { ReservaRepository } from '../reservas/repositories/reserva.repository';
import { PagamentoRepository } from './repositories/pagamento.repository';

@Injectable()
export class PagamentosService {
  private readonly logger = new Logger(PagamentosService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly isSandbox: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly reservasRepository: ReservaRepository,
    private readonly pagamentoRepository: PagamentoRepository,
    private readonly usuariosService: UsuariosService,
    private readonly emailsService: EmailsService,
  ) {
    // Obter configurações do ASAAS
    const asaasConfig = this.configService.get('asaas') || {};
    this.apiUrl = asaasConfig.apiUrl || 'https://api-sandbox.asaas.com/v3';
    this.apiKey =
      asaasConfig.apiKey ||
      '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmI5ODE1ZTU4LWI5NDMtNDMyNS1hYzBmLTBhODZkMGIwODRkOTo6JGFhY2hfMzc3ZjU2YjctNTAwYi00MmVhLWEzMGEtOTJlYmM4ZDczMWU4';
    this.isSandbox = this.configService.get('NODE_ENV') !== 'production';

    // Log de inicialização
    if (this.isSandbox) {
      this.logger.log('Serviço de pagamentos inicializado em modo sandbox');
    } else {
      this.logger.log('Serviço de pagamentos inicializado em modo produção');
    }
  }

  /**
   * Cria ou recupera um cliente no ASAAS
   */
  async criarOuRecuperarCliente(usuario: any): Promise<string> {
    try {
      // Verificar se o usuário já existe no ASAAS pelo CPF
      const buscaCliente = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/customers?cpfCnpj=${usuario.cpf}`,
          {
            headers: {
              access_token: this.apiKey,
            },
          },
        ),
      );

      // Se o cliente já existe, retorna o ID dele
      if (buscaCliente.data.data && buscaCliente.data.data.length > 0) {
        return buscaCliente.data.data[0].id;
      }
      // Se não existe, cria um novo cliente
      const novoCliente = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/customers`,
          {
            name: usuario.nome,
            cpfCnpj: usuario.cpf,
            mobilePhone: usuario.telefone,
            email: usuario.email,
            notificationDisabled: false,
          },
          {
            headers: {
              access_token: this.apiKey,
            },
          },
        ),
      );

      return novoCliente.data.id;
    } catch (error) {
      this.logger.error(`Erro ao criar/recuperar cliente no ASAAS: ${error}`);
      throw new HttpException(
        'Erro ao criar cliente no sistema de pagamento',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cria uma cobrança para a reserva
   */
  async criarCobranca(reservaId: string): Promise<any> {
    try {
      const reserva = await this.reservasRepository.findById(reservaId);
      const usuario = await this.usuariosService.findByCpf(reserva.usuario.cpf);

      // Verificar se já existe cobrança
      if (reserva.pagamento && reserva.pagamento.asaasId) {
        // Verificar status da cobrança existente
        const statusPagamento = await this.consultarStatusCobranca(
          reservaId,
        );

        if (statusPagamento.status !== StatusPagamento.CANCELADO) {
          return {
            asaasId: reserva.pagamento.asaasId,
            status: statusPagamento.status,
            valor: statusPagamento.valor,
            linkPagamento: statusPagamento.linkPagamento,
          };
        }
      }

      // Obter ou criar o cliente
      const clienteId = await this.criarOuRecuperarCliente(usuario);
      console.log(clienteId);
      // Calcular data de vencimento (7 dias a partir de hoje)
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 3);

      // Formatar data no formato ASAAS (YYYY-MM-DD)
      const dataFormatada = dataVencimento.toISOString().split('T')[0];

      // Criar a cobrança
      const cobranca = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/payments`,
          {
            customer: clienteId,
            billingType: 'BOLETO', // Pode ser BOLETO, CREDIT_CARD, PIX, etc.
            dueDate: dataFormatada,
            value: reserva.valorTotal,
            description: `Reserva #${reserva.codigo} - Fonte da Graça`,
            externalReference: reserva.codigo, // Referência da reserva para rastreabilidade
            postalService: false,
          },
          {
            headers: {
              access_token: this.apiKey,
            },
          },
        ),
      );

      const cobrancaCriada = await this.pagamentoRepository.createPagamento({
        reservaId: reserva,
        status: StatusPagamento.PENDENTE,
        asaasId: cobranca.data.id,
        valor: reserva.valorTotal,
        linkPagamento: cobranca.data.invoiceUrl,
      })

      // Enviar e-mail com link de pagamento
      await this.emailsService.enviarNotificacaoPagamento(
        usuario.email,
        usuario.nome,
        reserva.codigo,
        'pendente',
        cobranca.data.invoiceUrl
      );

      return cobrancaCriada;
    } catch (error) {
      this.logger.error(`Erro ao criar cobrança: ${error.message}`);
      throw new HttpException(
        'Erro ao gerar cobrança no sistema de pagamento',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Consulta o status de uma cobrança
   */
  async consultarStatusCobranca(reservaId: string): Promise<any> {
    try {
      const asaasId = (await this.reservasRepository.findById(reservaId)).pagamento.asaasId;

      const cobranca = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/payments/${asaasId}/status`, {
          headers: {
            access_token: this.apiKey,
          },
        }),
      );
      console.log(cobranca.data)
      return {
        asaasId: cobranca.data.id,
        valor: cobranca.data.value,
        status: this.mapearStatusAsaas(cobranca.data.status),
        dataPagamento: cobranca.data.paymentDate,
        linkPagamento: cobranca.data.invoiceUrl,
      };
    } catch (error) {
      this.logger.error(`Erro ao consultar cobrança: ${error.message}`);

      // Em caso de erro, tentar buscar pelo código da reserva
      if (reservaId.startsWith('RES')) {
        try {
          const reserva = await this.reservasRepository.findByCodigo(reservaId);
          if (reserva.pagamento.asaasId) {
            return this.consultarStatusCobranca(reservaId);
          }
        } catch (err) {
          // Ignorar este erro secundário
        }
      }

      throw new HttpException(
        'Erro ao consultar status do pagamento',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cancela uma cobrança no ASAAS
   */
  async cancelarCobranca(reservaId: string): Promise<boolean> {
    try {
      const reserva = await this.reservasRepository.findById(reservaId);
      const usuario = await this.usuariosService.findById(
        reserva.usuario.toString(),
      );

      if (!reserva.pagamento.asaasId) {
        throw new NotFoundException(
          'Pagamento não encontrado para esta reserva',
        );
      }

      // Cancelar no ASAAS
      await firstValueFrom(
        this.httpService.delete(
          `${this.apiUrl}/payments/${reserva.pagamento.asaasId}`,
          {
            headers: {
              access_token: this.apiKey,
            },
          },
        ),
      );

      // Atualizar status de pagamento para cancelado
      await this.atualizarPagamento(reservaId, {
        status: StatusPagamento.CANCELADO,
      });

      // Enviar email de notificação
      await this.emailsService.enviarNotificacaoPagamento(
        usuario.email,
        usuario.nome,
        reserva.codigo,
        'cancelado',
      );

      return true;
    } catch (error) {
      this.logger.error(`Erro ao cancelar cobrança: ${error.message}`);

      if (this.isSandbox) {
        return true; // Em sandbox, simular sucesso mesmo com erro
      }

      throw new HttpException(
        'Erro ao cancelar pagamento',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Processa um webhook do ASAAS
   */
  async processarWebhook(payload: any): Promise<void> {
    try {
      this.logger.log(`Webhook recebido: ${JSON.stringify(payload)}`);

      // Validar payload
      if (
        !payload.event ||
        !payload.payment ||
        !payload.payment.externalReference
      ) {
        throw new Error('Payload de webhook inválido');
      }

      // Mapear evento para status interno
      let status: StatusPagamento;
      let dataPagamento: string | null = null;

      switch (payload.event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          status = StatusPagamento.PAGO;
          dataPagamento = payload.payment.paymentDate;
          break;

        case 'PAYMENT_OVERDUE':
          status = StatusPagamento.PENDENTE;
          break;

        case 'PAYMENT_DELETED':
        case 'PAYMENT_REFUNDED':
          status = StatusPagamento.CANCELADO;
          break;

        default:
          this.logger.log(`Evento desconhecido: ${payload.event}`);
          return;
      }

      // Buscar reserva pelo código externo
      const codigoReserva = payload.payment.externalReference;
      const reserva = await this.reservasRepository.findByCodigo(codigoReserva);

      // Atualizar status do pagamento
      await this.atualizarPagamento(reserva._id.toString(), {
        status,
        dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined,
      });

      // Enviar notificação por email
      const usuario = await this.usuariosService.findByCpf(reserva.usuario.cpf);
      await this.emailsService.enviarNotificacaoPagamento(
        usuario.email,
        usuario.nome,
        reserva.codigo,
        status === StatusPagamento.PAGO
          ? 'pago'
          : status === StatusPagamento.CANCELADO
            ? 'cancelado'
            : 'pendente',
      );
    } catch (error) {
      this.logger.error(`Erro ao processar webhook: ${error.message}`);
      throw new HttpException(
        'Erro ao processar webhook de pagamento',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Atualiza o pagamento de uma reserva
   */
  async atualizarPagamento(
    reservaId: string,
    dados: {
      asaasId?: string;
      status?: StatusPagamento;
      linkPagamento?: string;
      dataPagamento?: Date;
    },
  ): Promise<void> {
    try {
      // Usar .findOne e .save para garantir que o middleware de pré-salvamento seja executado
      const reserva = await this.reservasRepository.findById(reservaId);

      if (!reserva) {
        throw new NotFoundException(
          `Reserva com ID "${reservaId}" não encontrada`,
        );
      }
      const pagamentoAtualizado = { ...reserva.pagamento };
      if (dados.asaasId !== undefined) {
        pagamentoAtualizado.asaasId = dados.asaasId;
      }

      if (dados.status !== undefined) {
        pagamentoAtualizado.status = dados.status;
      }

      if (dados.dataPagamento !== undefined) {
        pagamentoAtualizado.dataPagamento = dados.dataPagamento;
      }
      if (dados.linkPagamento !== undefined) {
        pagamentoAtualizado.linkPagamento = dados.linkPagamento;
      }

      reserva.pagamento = pagamentoAtualizado;

      // Adicionar ao histórico
      const novoHistorico = {
        data: new Date(),
        acao: `Pagamento ${dados.status || 'atualizado'}`,
        detalhes: dados.asaasId
          ? `ID de pagamento: ${dados.asaasId}`
          : `Status atualizado para ${dados.status || 'pendente'}`,
      };

      reserva.historico.push(novoHistorico);
      await reserva.save();
      this.logger.log(
        `Pagamento da reserva ${reservaId} atualizado com sucesso`,
      );
    } catch (error) {
      this.logger.error(`Erro ao atualizar pagamento: ${error.message}`);
      throw new Error(`Falha ao atualizar pagamento: ${error.message}`);
    }
  }

  /**
   * Mapeia o status do ASAAS para o formato interno
   */
  private mapearStatusAsaas(statusAsaas: string): StatusPagamento {
    const mapeamento = {
      PENDING: StatusPagamento.PENDENTE,
      RECEIVED: StatusPagamento.PAGO,
      CONFIRMED: StatusPagamento.PAGO,
      OVERDUE: StatusPagamento.PENDENTE,
      REFUNDED: StatusPagamento.CANCELADO,
      RECEIVED_IN_CASH: StatusPagamento.PAGO,
      REFUND_REQUESTED: StatusPagamento.PENDENTE,
      CHARGEBACK_REQUESTED: StatusPagamento.PENDENTE,
      CHARGEBACK_DISPUTE: StatusPagamento.PENDENTE,
      AWAITING_CHARGEBACK_REVERSAL: StatusPagamento.PENDENTE,
      DUNNING_REQUESTED: StatusPagamento.PENDENTE,
      DUNNING_RECEIVED: StatusPagamento.PAGO,
      AWAITING_RISK_ANALYSIS: StatusPagamento.PENDENTE,
    };

    return mapeamento[statusAsaas] || StatusPagamento.PENDENTE;
  }
}
