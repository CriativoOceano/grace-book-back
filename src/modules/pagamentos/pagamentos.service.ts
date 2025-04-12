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
import { ReservaRepository } from '../reservas/repositories/reserva.repository';
import { PagamentoRepository } from './repositories/pagamento.repository';
import { Reserva } from 'src/schemas/reserva.schema';
import { Usuario } from 'src/schemas/usuario.schema';
import {
  ModoPagamento,
  StatusPagamento,
  TipoPagamento,
} from './pagamento.enums';
import { IDadosPagamento } from './interfaces/dados-pagamento.interface';
import { EmailsService } from '../emails/email.service';
import { CalculoReservaService } from '../shared/services/reservaProcesso/calcular-reserva.service';
import { CreateReservaDto } from '../reservas/dto/create-reserva.dto';
@Injectable()
export class PagamentosService {
  private readonly logger = new Logger(PagamentosService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly isSandbox: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly pagamentoRepository: PagamentoRepository,
    private readonly usuariosService: UsuariosService,
    private readonly emailsService: EmailsService,
    private readonly reservaRepository: ReservaRepository,
    private readonly calculoReservaService: CalculoReservaService,
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
  async criarCobranca(
    reservaId: string,
    dadosPagamento: IDadosPagamento,
  ): Promise<any> {
    try {
      const reserva: Reserva = await this.reservaRepository.findById(reservaId);
      const usuario: Usuario = await this.usuariosService.findByCpf(
        reserva.usuario.cpf,
      );

      if (reserva.pagamento && reserva.pagamento.asaasPagamentoId) {
        const statusPagamento = await this.consultarStatusCobranca(reservaId);

        if (statusPagamento.status !== StatusPagamento.CANCELADO) {
          return {
            asaasId: reserva.pagamento.asaasPagamentoId,
            status: statusPagamento.status,
            valor: statusPagamento.valor,
            linkPagamento: statusPagamento.linkPagamento,
          };
        }
      }

      const clienteId = await this.criarOuRecuperarCliente(usuario);
      const quantidadeDiarias = await this.getQtdDias(
        reserva.dataInicio,
        reserva.dataFim || reserva.dataInicio,
      );

      const reservaData: CreateReservaDto = {
        tipo: reserva.tipo,
        quantidadePessoas: reserva.quantidadePessoas,
        quantidadeChales: reserva.quantidadeChales,
        quantidadeDiarias: quantidadeDiarias,
        dadosPagamento: dadosPagamento,
        dataInicio: reserva.dataInicio,
        dataFim: reserva.dataFim,
      };
      // Calcular valor da reserva
      const valorTotaldaReserva =
        await this.calculoReservaService.getValorReserva(reservaData);

      dadosPagamento.valorTotal = valorTotaldaReserva;

      const cobranca = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/checkouts`,
          this.buildDadosPagamento(reserva, clienteId, dadosPagamento),
          {
            headers: {
              access_token: this.apiKey,
            },
          },
        ),
      );
      this.logger.log(`Cobranca criada com sucesso: ${cobranca.data}`);
      const cobrancaCriada = await this.pagamentoRepository.createPagamento({
        reservaId: reserva,
        status: StatusPagamento.PENDENTE,
        asaasPagamentoId: cobranca.data.id,
        valorTotal: dadosPagamento.valorTotal,
        linkPagamento: cobranca.data.link,
        modoPagamento: dadosPagamento.modoPagamento,
        qtdParcelas: dadosPagamento.parcelas,
      });

      // Enviar e-mail com link de pagamento
      await this.emailsService.enviarNotificacaoPagamento(
        usuario.email,
        usuario.nome,
        reserva.codigo,
        'pendente',
        cobranca.data.invoiceUrl,
      );

      return cobrancaCriada;
    } catch (error) {
      this.logger.error(`Erro ao criar cobrança: ${error}`);
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
      const asaasId = (await this.reservaRepository.findById(reservaId))
        .pagamento.asaasPagamentoId;

      const cobranca = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/payments/${asaasId}/status`, {
          headers: {
            access_token: this.apiKey,
          },
        }),
      );

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
          const reserva = await this.reservaRepository.findByCodigo(reservaId);
          if (reserva.pagamento.asaasPagamentoId) {
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
      const pagamentos =
        await this.pagamentoRepository.findByReservaId(reservaId);

      for (const pagamento of pagamentos) {
        if (!pagamento.asaasPagamentoId) {
          throw new NotFoundException(
            'Pagamento não encontrado no gateway de pagamentos',
          );
        }
        await firstValueFrom(
          this.httpService.delete(
            `${this.apiUrl}/payments/${pagamento.asaasPagamentoId}`,
            {
              headers: {
                access_token: this.apiKey,
              },
            },
          ),
        );
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Erro ao cancelar cobrança no gateway de pagamentos: ${error.message}`,
      );

      throw new HttpException(
        'Erro ao cancelar cobrança no gateway de pagamentos',
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
      const reserva = await this.reservaRepository.findByCodigo(codigoReserva);

      this.pagamentoRepository.updatePagamento(reserva._id.toString(), {
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

  private buildDadosPagamento(
    reserva: Reserva,
    clienteId: string,
    dadosPagamento: IDadosPagamento,
  ) {
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 3);
    const dataFormatada = dataVencimento.toISOString().split('T')[0];

    switch (dadosPagamento.modoPagamento) {
      case ModoPagamento.PIX:
        return {
          billingTypes: [dadosPagamento.modoPagamento],
          chargeTypes: ['DETACHED'],
          minutesToExpire: 60,
          callback: {
            cancelUrl: 'https://meusite.com/cancelado',
            expiredUrl: 'https://meusite.com/expirado',
            successUrl: 'https://meusite.com/sucesso',
          },
          items: [
            {
              name: 'Diárias',
              description: 'Diárias reservadas',
              quantity: reserva.quantidadeDiarias,
              value: dadosPagamento.valorTotal,
            },
          ],
        };
      case ModoPagamento.CARTAO:
        return {
          billingTypes: [dadosPagamento.modoPagamento],
          chargeTypes: ['DETACHED', dadosPagamento.tipoPagamento],
          minutesToExpire: 15,
          callback: {
            cancelUrl: 'https://meusite.com/cancelado',
            expiredUrl: 'https://meusite.com/expirado',
            successUrl: 'https://meusite.com/sucesso',
          },
          items: [
            {
              name: 'Diárias',
              description: 'Diárias reservadas',
              quantity: reserva.quantidadeDiarias,
              value: dadosPagamento.valorTotal,
            },
          ],
        };
      default:
        'Modo de pagamento inválido';
        throw new HttpException(
          'Modo de pagamento inválido',
          HttpStatus.BAD_REQUEST,
        );
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
