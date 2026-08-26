import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ReservaRepository } from '../reservas/repositories/reserva.repository';
import { PagamentoRepository } from './repositories/pagamento.repository';
import { Reserva } from 'src/schemas/reserva.schema';
import { Pagamento } from 'src/schemas/pagamentos.schema';
import { DadosHospede } from '../../interfaces/dados-hospede.interface';
import { Usuario } from 'src/schemas/usuario.schema';
import {
  ModoPagamento,
  StatusPagamento,
  TipoPagamento,
} from './pagamento.enums';
import { IDadosPagamento } from './interfaces/dados-pagamento.interface';
import { EmailsService } from '../emails/email.service';
import { CalculoReservaService } from '../shared/services/reservaProcesso/calcular-reserva.service';
import { CreateReservaDto } from '../reservas/DTO/create-reserva.dto';
import { StatusReserva } from '../reservas/reserva.enums';
import {
  ReservaEmailData,
  ReservaCanceladaEmailData,
} from '../emails/templates/reserva-confirmacao.template';
import { CONFIGURACOES_REPOSITORY } from '../configuracoes/repositories/configuracaoes-repository.provider';
import { IConfiguracoesRepository } from '../configuracoes/repositories/interfaces/reserva-repository.interface';
import { v4 as uuidv4 } from 'uuid';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ReservaHold,
  ReservaHoldDocument,
} from 'src/schemas/reserva-hold.schema';
import { TipoReserva } from '../reservas/reserva.enums';

// Timeout para chamadas HTTP ao ASAAS - evita travar a requisição
// indefinidamente se o gateway de pagamento ficar lento ou não responder.
const ASAAS_TIMEOUT_MS = 15000;

// Detalhe técnico de uma chamada ao Asaas que falhou (ou não confirmou o
// resultado esperado), usado só em fluxos admin — nunca inclui a
// access_token/API key, de propósito, pra não vazar credencial em resposta
// HTTP nem em log.
export interface AsaasErrorDetails {
  method: string;
  endpoint: string;
  httpStatus: number | null;
  asaasResponse: any;
  originalMessage: string;
}
@Injectable()
export class PagamentosService {
  private readonly logger = new Logger(PagamentosService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly isSandbox: boolean;
  private readonly frontendBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly pagamentoRepository: PagamentoRepository,
    private readonly usuariosService: UsuariosService,
    private readonly emailsService: EmailsService,
    private readonly reservaRepository: ReservaRepository,
    private readonly calculoReservaService: CalculoReservaService,
    @Inject(CONFIGURACOES_REPOSITORY)
    private readonly configuracoesRepository: IConfiguracoesRepository,
    @InjectModel(ReservaHold.name)
    private readonly reservaHoldModel: Model<ReservaHoldDocument>,
  ) {
    // Obter configurações do ASAAS das variáveis de ambiente
    this.apiUrl = this.configService.get('ASAAS_API_URL');
    this.apiKey = this.configService.get('ASAAS_API_KEY');
    this.isSandbox = this.configService.get('NODE_ENV') !== 'production';

    // URL base do frontend para callbacks
    this.frontendBaseUrl = this.configService.get('FRONTEND_URL');

    // Executar migração de dados na inicialização
    this.executarMigracaoDados();
  }

  /**
   * Executa migração de dados existentes
   */
  private async executarMigracaoDados(): Promise<void> {
    try {
      await this.pagamentoRepository.migrarDadosExistentes();
    } catch (error) {
      this.logger.error(`❌ Erro na migração de dados: ${error.message}`);
    }
  }

  /**
   * Método público para executar migração manual
   */
  async migrarDadosExistentes(): Promise<void> {
    await this.pagamentoRepository.migrarDadosExistentes();
  }

  /**
   * Cria ou recupera um cliente no ASAAS
   */
  async criarOuRecuperarCliente(usuario: any): Promise<string> {
    try {
      // Limpar CPF para busca (remover formatação)
      const cpfLimpo = usuario.cpf.replace(/\D/g, '');

      // Verificar se o usuário já existe no ASAAS pelo CPF
      const buscaCliente = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/customers?cpfCnpj=${cpfLimpo}`, {
          headers: {
            access_token: this.apiKey,
          },
          timeout: ASAAS_TIMEOUT_MS,
        }),
      );

      // Se o cliente já existe, retorna o ID dele
      if (buscaCliente.data.data && buscaCliente.data.data.length > 0) {
        return buscaCliente.data.data[0].id;
      }
      // Se não existe, cria um novo cliente
      const dadosCliente = {
        name: usuario.nome,
        cpfCnpj: cpfLimpo, // Usar CPF limpo (sem formatação)
        mobilePhone: usuario.telefone,
        email: usuario.email,
        notificationDisabled: false,
      };

      const novoCliente = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/customers`, dadosCliente, {
          headers: {
            access_token: this.apiKey,
          },
          timeout: ASAAS_TIMEOUT_MS,
        }),
      );

      return novoCliente.data.id;
    } catch (error) {
      this.logger.error(`Erro ao criar/recuperar cliente no ASAAS: ${error.message || error}`);
      if (error.response) {
        this.logger.error(
          `Status HTTP: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`,
        );
      }

      // Verificar se é erro de autenticação
      if (error.response?.status === 401) {
        this.logger.error('Erro 401: API Key do ASAAS inválida ou expirada');
        throw new HttpException(
          'Erro de autenticação com o sistema de pagamento. Verifique a configuração da API Key.',
          HttpStatus.UNAUTHORIZED,
        );
      }

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
    session?: any,
    // false quando quem chamou (a criação da reserva) já vai mandar o
    // e-mail completo de "reserva criada" (que inclui o link de
    // pagamento) logo em seguida — sem isso, o cliente recebia dois
    // e-mails de "pagamento pendente" pro mesmo evento: este aviso
    // genérico e o e-mail completo. Mantido true por padrão porque
    // retentarGeracaoCheckout (gerar um novo link) depende deste aviso
    // ser o único e-mail enviado nesse caso.
    notificarPorEmail: boolean = true,
  ): Promise<any> {
    // Precisa da mesma sessão da transação que criou a reserva: quando
    // chamado de dentro de processarNovaReserva, a reserva ainda não foi
    // commitada, e uma leitura sem a sessão simplesmente não a encontra
    // (isolamento padrão de transação do Mongo).
    const reserva: Reserva = await this.reservaRepository.findById(
      reservaId,
      { session },
    );

    // Verificar se já existe pagamento para esta reserva
    const pagamentosExistentes =
      await this.pagamentoRepository.findByReservaId(reservaId);

    if (pagamentosExistentes && pagamentosExistentes.length > 0) {
      const pagamentoExistente = pagamentosExistentes[0];

      if (
        pagamentoExistente.asaasCheckoutSessionId &&
        pagamentoExistente.status !== StatusPagamento.CANCELADO
      ) {
        // Consultar status atual no ASAAS
        try {
          const statusPagamento = await this.consultarStatusCobranca(reservaId);
          return {
            asaasId: pagamentoExistente.asaasCheckoutSessionId,
            status: statusPagamento.status,
            valor: statusPagamento.valor,
            linkPagamento: statusPagamento.linkPagamento,
          };
        } catch (error) {
          // Se não conseguir consultar o status, retornar dados do banco
          this.logger.warn(
            `Não foi possível consultar status da cobrança ${pagamentoExistente.asaasCheckoutSessionId}, retornando dados do banco`,
          );
          return {
            asaasId: pagamentoExistente.asaasCheckoutSessionId,
            status: pagamentoExistente.status,
            valor: pagamentoExistente.valorTotal,
            linkPagamento: pagamentoExistente.linkPagamento,
          };
        }
      }
    }

    // Verificar se já existe cobrança no ASAAS pela chave de idempotência ANTES de tentar criar
    const idempotencyKey = uuidv4(); // Gerar UUID único para esta tentativa de cobrança

    // Verificar se já existe cobrança no ASAAS pela chave de idempotência
    try {
      const buscaPrevia = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/checkouts?externalReference=${idempotencyKey}`,
          {
            headers: {
              access_token: this.apiKey,
            },
            timeout: ASAAS_TIMEOUT_MS,
          },
        ),
      );

      if (buscaPrevia.data.data && buscaPrevia.data.data.length > 0) {
        const checkoutExistente = buscaPrevia.data.data[0];

        // Criar registro de pagamento no banco se não existir
        if (!pagamentosExistentes || pagamentosExistentes.length === 0) {
          await this.pagamentoRepository.createPagamento({
            reservaId: reserva,
            status: StatusPagamento.PENDENTE,
            asaasCheckoutSessionId: checkoutExistente.id, // Checkout Session ID
            valorTotal: dadosPagamento.valorTotal,
            linkPagamento: checkoutExistente.link,
            modoPagamento: dadosPagamento.modoPagamento,
            qtdParcelas: dadosPagamento.parcelas,
            asaasInstallmentId:
              checkoutExistente.installment?.id || checkoutExistente.installmentId,
            detalhes: checkoutExistente,
          });
        }

        return {
          asaasId: checkoutExistente.id,
          status: StatusPagamento.PENDENTE,
          valor: dadosPagamento.valorTotal,
          linkPagamento: checkoutExistente.link,
        };
      }
    } catch (buscaError) {
      // Continuar com a criação da nova cobrança
    }

    try {
      const usuario: Usuario = await this.usuariosService.findByCpf(
        reserva.usuario.cpf,
      );

      // Não criar usuário no ASAAS automaticamente - usuário preencherá no checkout
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
      dadosPagamento.valorDiaria = valorTotaldaReserva.valorDiaria;
      dadosPagamento.valorDiariaComChale =
        valorTotaldaReserva.valorDiariaComChale;
      dadosPagamento.valorTotal = valorTotaldaReserva.valorTotal;

      const dadosCobranca = await this.buildDadosPagamento(
        reserva,
        dadosPagamento,
      );

      // Usar UUID como chave de idempotência
      (dadosCobranca as any).externalId = idempotencyKey;

      this.logger.log(
        `🔄 Enviando requisição para ASAAS - URL: ${this.apiUrl}/checkouts`,
      );
      this.logger.log(
        `🔄 Dados da cobrança: ${JSON.stringify(dadosCobranca, null, 2)}`,
      );

      const cobranca = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/checkouts`, dadosCobranca, {
          headers: {
            access_token: this.apiKey,
            'Idempotency-Key': idempotencyKey, // Header para idempotência
          },
          timeout: ASAAS_TIMEOUT_MS,
        }),
      ).catch((error) => {
        this.logger.error(`❌ Erro na requisição para ASAAS:`);
        this.logger.error(`❌ Status: ${error.response?.status}`);
        this.logger.error(`❌ Status Text: ${error.response?.statusText}`);
        this.logger.error(
          `❌ Headers: ${JSON.stringify(error.response?.headers)}`,
        );
        this.logger.error(`❌ Data: ${JSON.stringify(error.response?.data)}`);
        this.logger.error(`❌ Config: ${JSON.stringify(error.config)}`);
        this.logger.error(`❌ Message: ${error.message}`);
        this.logger.error(`❌ Code: ${error.code}`);
        throw error;
      });

      this.logger.log(`✅ Resposta do ASAAS recebida com sucesso:`);
      this.logger.log(`✅ Status: ${cobranca.status}`);
      this.logger.log(`✅ Data: ${JSON.stringify(cobranca.data)}`);

      const cobrancaCriada = await this.pagamentoRepository.createPagamento({
        reservaId: reserva,
        status: StatusPagamento.PENDENTE,
        asaasCheckoutSessionId: cobranca.data.id, // Checkout Session ID
        valorTotal: dadosPagamento.valorTotal,
        linkPagamento: cobranca.data.link,
        modoPagamento: dadosPagamento.modoPagamento,
        qtdParcelas: dadosPagamento.parcelas,
        asaasInstallmentId:
          cobranca.data.installment?.id || cobranca.data.installmentId,
        detalhes: cobranca.data,
      });

      // Enviar e-mail com link de pagamento. A cobrança no Asaas e o
      // registro do pagamento já foram criados com sucesso acima — uma
      // falha aqui (chave do Resend errada, serviço fora do ar etc.) não
      // pode derrubar a transação inteira e desfazer uma cobrança que já
      // existe de verdade no Asaas.
      if (notificarPorEmail) {
        try {
          await this.emailsService.enviarNotificacaoPagamento(
            usuario.email,
            usuario.nome,
            reserva.codigo,
            'pendente',
            cobranca.data.invoiceUrl,
          );
        } catch (emailError) {
          this.logger.error(
            `❌ Cobrança criada com sucesso, mas falhou o envio do e-mail com o link de pagamento: ${emailError.message}`,
          );
        }
      }

      return cobrancaCriada;
    } catch (error) {
      this.logger.error(`❌ Erro ao criar cobrança:`);
      this.logger.error(`❌ Tipo do erro: ${error.constructor.name}`);
      this.logger.error(`❌ Mensagem: ${error.message}`);
      this.logger.error(`❌ Stack trace: ${error.stack}`);

      // Log específico para erros HTTP
      if (error.response) {
        this.logger.error(`❌ Status HTTP: ${error.response.status}`);
        this.logger.error(`❌ Status Text: ${error.response.statusText}`);
        this.logger.error(
          `❌ Headers: ${JSON.stringify(error.response.headers)}`,
        );
        this.logger.error(`❌ Data: ${JSON.stringify(error.response.data)}`);
      }

      // Log específico para erros de rede/timeout
      if (
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND'
      ) {
        this.logger.error(`❌ ERRO DE REDE/TIMEOUT detectado`);
        this.logger.error(`❌ Código do erro: ${error.code}`);
        this.logger.error(`❌ URL do ASAAS: ${this.apiUrl}`);
        this.logger.error(`❌ Verificar conectividade com o ASAAS`);
      }

      // Verificar se é erro de idempotência (cobrança já existe)
      if (
        error.response?.status === 409 ||
        error.response?.data?.errors?.some(
          (e: any) => e.code === 'DUPLICATE_EXTERNAL_ID',
        )
      ) {
        // Aguardar um pouco para garantir que a primeira requisição tenha terminado
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Buscar cobrança existente novamente
        const cobrancaExistente =
          await this.pagamentoRepository.findByReservaId(reservaId);
        if (cobrancaExistente && cobrancaExistente.length > 0) {
          const pagamento = cobrancaExistente[0];

          // Se ainda não tem asaasCheckoutSessionId, aguardar mais um pouco
          if (!pagamento.asaasCheckoutSessionId) {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Buscar novamente
            const cobrancaAtualizada =
              await this.pagamentoRepository.findByReservaId(reservaId);
            if (
              cobrancaAtualizada &&
              cobrancaAtualizada.length > 0 &&
              cobrancaAtualizada[0].asaasCheckoutSessionId
            ) {
              const pagamentoAtualizado = cobrancaAtualizada[0];
              return {
                asaasId: pagamentoAtualizado.asaasCheckoutSessionId,
                status: pagamentoAtualizado.status,
                valor: pagamentoAtualizado.valorTotal,
                linkPagamento: pagamentoAtualizado.linkPagamento,
              };
            }
          }

          return {
            asaasId: pagamento.asaasCheckoutSessionId,
            status: pagamento.status,
            valor: pagamento.valorTotal,
            linkPagamento: pagamento.linkPagamento,
          };
        }

        // Se ainda não encontrou, tentar buscar pela chave de idempotência

        // Buscar no ASAAS pela chave de idempotência
        try {
          const buscaAsaas = await firstValueFrom(
            this.httpService.get(
              `${this.apiUrl}/checkouts?externalReference=${idempotencyKey}`,
              {
                headers: {
                  access_token: this.apiKey,
                },
                timeout: ASAAS_TIMEOUT_MS,
              },
            ),
          );

          if (buscaAsaas.data.data && buscaAsaas.data.data.length > 0) {
            const checkoutExistente = buscaAsaas.data.data[0];

            // Criar registro de pagamento no banco se não existir
            const pagamentoExistente =
              await this.pagamentoRepository.findByReservaId(reservaId);
            if (!pagamentoExistente || pagamentoExistente.length === 0) {
              await this.pagamentoRepository.createPagamento({
                reservaId: reserva,
                status: StatusPagamento.PENDENTE,
                asaasCheckoutSessionId: checkoutExistente.id, // Checkout Session ID
                valorTotal: dadosPagamento.valorTotal,
                linkPagamento: checkoutExistente.link,
                modoPagamento: dadosPagamento.modoPagamento,
                qtdParcelas: dadosPagamento.parcelas,
                asaasInstallmentId:
                  checkoutExistente.installment?.id ||
                  checkoutExistente.installmentId,
                detalhes: checkoutExistente,
              });
            }

            return {
              asaasId: checkoutExistente.id,
              status: StatusPagamento.PENDENTE,
              valor: dadosPagamento.valorTotal,
              linkPagamento: checkoutExistente.link,
            };
          }
        } catch (buscaError) {
          this.logger.warn(
            `Erro ao buscar cobrança no ASAAS: ${buscaError.message}`,
          );

          // Se a busca falhou, retornar erro mais específico
          if (buscaError.response?.status === 404) {
            this.logger.error(
              `Cobrança não encontrada no ASAAS para chave: ${idempotencyKey}`,
            );
            throw new HttpException(
              'Cobrança não encontrada no sistema de pagamento. Tente novamente.',
              HttpStatus.NOT_FOUND,
            );
          }
        }
      }

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
        .pagamento.asaasCheckoutSessionId;

      const cobranca = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/payments/${asaasId}/status`, {
          headers: {
            access_token: this.apiKey,
          },
          timeout: ASAAS_TIMEOUT_MS,
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
          if (reserva.pagamento.asaasCheckoutSessionId) {
            return this.consultarStatusCobranca(reserva._id.toString());
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
   * Cancela a Checkout Session pendente de uma reserva no ASAAS.
   *
   * Importante: isso NÃO é "cancelar uma cobrança" — no Asaas, cobrança
   * (objeto "payment", pay_*) e Checkout Session são coisas diferentes, e
   * uma cobrança de verdade só passa a existir depois que o cliente paga
   * (via webhook). Enquanto o pagamento está PENDENTE só existe a Checkout
   * Session (o link), então o que dá pra cancelar aqui é ela — não há
   * cobrança pra cancelar ainda. Se o pagamento já foi recebido, o caminho
   * correto é estorno (processarEstornoPagamento), não isto.
   *
   * Fluxo: identificar o(s) pagamento(s) da reserva na base interna →
   * validar se cada um ainda está PENDENTE (só faz sentido cancelar o
   * checkout se ninguém pagou ainda) → solicitar o cancelamento via Asaas →
   * validar a resposta → atualizar o status do pagamento na base interna.
   *
   * Usamos POST /v3/checkouts/{id}/cancel (não DELETE /v3/payments/{id}):
   * chamar /v3/payments/{id} com o ID da checkout session sempre
   * retorna 404, porque não existe "payment" nenhum pra esse ID. Best-effort:
   * se o Asaas falhar aqui (ex.: checkout já expirou ou foi pago numa
   * corrida com o cancelamento), a reserva ainda assim é cancelada — a rede
   * de segurança real é a expiração automática do checkout e
   * recuperarOuEstornarReservaCancelada() no webhook.
   */
  async cancelarCheckoutPendente(
    reservaId: string,
  ): Promise<{ sucesso: boolean; avisos: AsaasErrorDetails[] }> {
    const pagamentos =
      await this.pagamentoRepository.findByReservaId(reservaId);
    const avisos: AsaasErrorDetails[] = [];

    for (const pagamento of pagamentos) {
      if (pagamento.status !== StatusPagamento.PENDENTE) {
        continue; // já pago, cancelado ou estornado — nada a fazer aqui
      }

      if (!pagamento.asaasCheckoutSessionId) {
        this.logger.warn(
          `Pagamento ${(pagamento as any)._id} sem checkout session no Asaas — nada para cancelar`,
        );
        continue;
      }

      const endpoint = `${this.apiUrl}/checkouts/${pagamento.asaasCheckoutSessionId}/cancel`;

      try {
        const cancelamento = await firstValueFrom(
          this.httpService.post(
            endpoint,
            {},
            {
              headers: {
                access_token: this.apiKey,
              },
              timeout: ASAAS_TIMEOUT_MS,
            },
          ),
        );

        if (cancelamento.data?.status !== 'CANCELED') {
          const aviso: AsaasErrorDetails = {
            method: 'POST',
            endpoint,
            httpStatus: cancelamento.status,
            asaasResponse: cancelamento.data,
            originalMessage: `Checkout não confirmou CANCELED (retornou: ${cancelamento.data?.status})`,
          };
          this.logger.warn(`Checkout ${pagamento.asaasCheckoutSessionId} não confirmou CANCELED (retornou: ${cancelamento.data?.status})`);
          avisos.push(aviso);
          continue;
        }

        await this.pagamentoRepository.updatePagamento(
          (pagamento as any)._id.toString(),
          { status: StatusPagamento.CANCELADO },
        );
      } catch (error) {
        const aviso: AsaasErrorDetails = {
          method: 'POST',
          endpoint,
          httpStatus: error.response?.status ?? null,
          asaasResponse: error.response?.data ?? null,
          originalMessage: error.message,
        };
        this.logger.warn(
          `Não foi possível cancelar o checkout ${pagamento.asaasCheckoutSessionId} no Asaas: ${error.message}`,
        );
        avisos.push(aviso);
      }
    }

    return { sucesso: avisos.length === 0, avisos };
  }

  /**
   * Processa um webhook do ASAAS
   */
  async processarWebhook(payload: any): Promise<void> {
    try {
      // Determinar o tipo de payload (checkout ou payment)
      let checkoutId: string;
      let eventType: string;
      let status: StatusPagamento;
      let dataPagamento: Date | undefined;

      // Verificar se é payload de checkout
      if (payload.event && payload.checkout) {
        checkoutId = payload.checkout.id;
        eventType = payload.event;

        switch (eventType) {
          case 'CHECKOUT_PAID':
            status = StatusPagamento.PAGO;
            dataPagamento = payload.dateCreated
              ? new Date(payload.dateCreated)
              : new Date();
            break;
          case 'CHECKOUT_EXPIRED':
            status = StatusPagamento.CANCELADO; // ✅ Cancelar quando checkout expira
            this.logger.warn(
              `🚨 CHECKOUT EXPIRADO - Cancelando reserva: ${checkoutId}`,
            );
            break;
          case 'CHECKOUT_CANCELED':
            status = StatusPagamento.CANCELADO;
            break;
          default:
            return;
        }
      }
      // Verificar se é payload de payment (formato mais antigo)
      else if (payload.event && payload.payment) {
        // Priorizar checkoutSession se disponível, senão usar payment.id
        checkoutId = payload.payment.checkoutSession || payload.payment.id;
        eventType = payload.event;

        switch (eventType) {
          case 'PAYMENT_RECEIVED':
          case 'PAYMENT_CONFIRMED':
            status = StatusPagamento.PAGO;
            dataPagamento = payload.payment.paymentDate
              ? new Date(payload.payment.paymentDate)
              : new Date();
            break;
          case 'PAYMENT_OVERDUE':
            status = StatusPagamento.CANCELADO; // ✅ Cancelar quando pagamento vence
            this.logger.warn(
              `🚨 PAGAMENTO VENCIDO - Cancelando reserva: ${checkoutId}`,
            );
            break;
          case 'PAYMENT_DELETED':
          case 'PAYMENT_REFUNDED':
            status = StatusPagamento.CANCELADO;
            break;
          default:
            return;
        }
      }
      // Verificar se é payload direto de payment (formato mais simples)
      else if (payload.id && payload.status) {
        checkoutId = payload.id;
        eventType = 'PAYMENT_STATUS_CHANGE';
        status = this.mapearStatusAsaas(payload.status);
        dataPagamento = payload.paymentDate
          ? new Date(payload.paymentDate)
          : new Date();
      } else {
        this.logger.error(
          `Payload de webhook inválido: ${JSON.stringify(payload)}`,
        );
        throw new Error(
          'Payload de webhook inválido - formato não reconhecido',
        );
      }

      if (!checkoutId) {
        throw new Error('ID de checkout/payment não encontrado no payload');
      }

      // Buscar pagamento por qualquer ID do ASAAS (checkout session ou payment)
      let pagamento = await this.pagamentoRepository.findByAsaasId(checkoutId);

      // Se não encontrou e é um webhook de payment, tentar buscar pelo checkoutSession
      if (
        !pagamento &&
        payload.payment?.checkoutSession &&
        payload.payment?.id
      ) {
        pagamento = await this.pagamentoRepository.findByCheckoutSessionId(
          payload.payment.checkoutSession,
        );

        if (pagamento) {
        }
      }

      if (!pagamento) {
        this.logger.error(`Pagamento não encontrado para o ID: ${checkoutId}`);
        this.logger.error(`Tentando buscar por diferentes campos...`);

        // Log de debug para entender o que está acontecendo
        const checkoutSessionSearch =
          await this.pagamentoRepository.findByCheckoutSessionId(checkoutId);
        const paymentIdSearch =
          await this.pagamentoRepository.findByPaymentId(checkoutId);
        const externalIdSearch =
          await this.pagamentoRepository.findByExternalId(checkoutId);

        this.logger.error(
          `Busca por checkoutSessionId: ${checkoutSessionSearch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`,
        );
        this.logger.error(
          `Busca por paymentId: ${paymentIdSearch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`,
        );
        this.logger.error(
          `Busca por externalId: ${externalIdSearch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`,
        );

        // Se temos ambos os IDs no payload, tentar buscar pelo outro
        if (payload.payment?.checkoutSession && payload.payment?.id) {
          this.logger.error(
            `Tentando busca alternativa pelo checkoutSession: ${payload.payment.checkoutSession}`,
          );
          const altSearch =
            await this.pagamentoRepository.findByCheckoutSessionId(
              payload.payment.checkoutSession,
            );
          this.logger.error(
            `Busca alternativa por checkoutSession: ${altSearch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`,
          );
        }

        throw new Error(`Pagamento não encontrado para o ID: ${checkoutId}`);
      }

      // Buscar reserva pelo ID do pagamento
      const reserva = await this.reservaRepository.findByPagamentoId(
        pagamento._id.toString(),
      );

      if (!reserva) {
        throw new Error(
          `Reserva não encontrada para o pagamentoId: ${pagamento._id}`,
        );
      }

      // Idempotência: o ASAAS reenvia webhooks (retry). Se o pagamento já
      // está no status de destino, não repetir a atualização nem reenviar
      // os e-mails de confirmação/cancelamento - apenas confirmar recebido.
      if (pagamento.status === status) {
        this.logger.log(
          `↩️ Webhook duplicado ignorado - pagamento ${pagamento._id} já está em ${status} (evento: ${eventType})`,
        );
        return;
      }

      // Atualizar status do pagamento e salvar Payment ID se necessário
      const updateData: any = {
        status,
        dataPagamento,
        detalhes: payload,
      };

      // Se o webhook contém um Payment ID e ainda não foi salvo, salvar agora
      if (payload.payment?.id && !pagamento.asaasPaymentId) {
        updateData.asaasPaymentId = payload.payment.id;
      }

      await this.pagamentoRepository.updatePagamento(
        pagamento._id.toString(),
        updateData,
      );

      // Atualizar status da reserva com detalhes específicos
      if (status === StatusPagamento.PAGO) {
        // A reserva pode já ter sido cancelada (ex.: expirou por tempo)
        // antes desse webhook de confirmação chegar. Não aceitar o
        // pagamento como válido sem checar isso primeiro — senão o cliente
        // é cobrado por uma data que já não é mais garantida dele.
        if (reserva.statusReserva === StatusReserva.CANCELADA) {
          const reativada = await this.recuperarOuEstornarReservaCancelada(
            reserva,
            pagamento,
            eventType,
          );
          if (!reativada) {
            return;
          }
        }

        await this.reservaRepository.atualizarStatus(
          reserva._id.toString(),
          StatusReserva.CONFIRMADA,
          `Pagamento confirmado via ASAAS - Evento: ${eventType}`,
        );

        // Enviar email de confirmação de pagamento
        try {
          const emailData: ReservaEmailData = {
            nome: reserva.usuarioNome,
            codigoReserva: reserva.codigo,
            dataInicio: reserva.dataInicio.toLocaleDateString('pt-BR'),
            dataFim: reserva.dataFim.toLocaleDateString('pt-BR'),
            tipo: reserva.tipo,
            quantidadePessoas: reserva.quantidadePessoas,
            quantidadeChales: reserva.quantidadeChales,
            quantidadeDiarias: reserva.quantidadeDiarias,
            valorTotal: reserva.valorTotal,
            statusReserva: StatusReserva.CONFIRMADA,
            codigoAcesso: reserva.codigoAcesso,
            observacoes: reserva.observacoes,
            dadosHospede: reserva.dadosHospede,
          };

          await this.emailsService.enviarEmailReservaConfirmada(emailData);

          // Enviar email de notificação para o administrador
          await this.emailsService.enviarEmailNotificacaoAdministrador(
            emailData,
          );
        } catch (emailError) {
          this.logger.error(
            `❌ Erro ao enviar email de confirmação: ${emailError.message}`,
          );
          // Não falhar o processamento do webhook por erro de email
        }
      } else if (status === StatusPagamento.CANCELADO) {
        // Determinar motivo específico do cancelamento
        let motivoCancelamento = 'Pagamento cancelado via ASAAS';

        if (eventType === 'CHECKOUT_EXPIRED') {
          motivoCancelamento = 'Checkout expirado - Tempo limite excedido';
        } else if (eventType === 'CHECKOUT_CANCELED') {
          motivoCancelamento = 'Checkout cancelado pelo usuário';
        } else if (eventType === 'PAYMENT_OVERDUE') {
          motivoCancelamento =
            'Pagamento vencido - Não foi processado no prazo';
        } else if (
          eventType === 'PAYMENT_STATUS_CHANGE' &&
          payload.status === 'OVERDUE'
        ) {
          motivoCancelamento =
            'Pagamento vencido - Status alterado para OVERDUE';
        } else if (eventType === 'PAYMENT_DELETED') {
          motivoCancelamento = 'Pagamento deletado no ASAAS';
        } else if (eventType === 'PAYMENT_REFUNDED') {
          motivoCancelamento = 'Pagamento reembolsado';
        }

        await this.reservaRepository.atualizarStatus(
          reserva._id.toString(),
          StatusReserva.CANCELADA,
          `${motivoCancelamento} - Evento: ${eventType}`,
        );

        this.logger.warn(
          `🚨 Reserva ${reserva.codigo} cancelada - Motivo: ${motivoCancelamento}`,
        );

        // Enviar email específico de reserva cancelada
        try {
          const emailData: ReservaCanceladaEmailData = {
            nome: reserva.usuarioNome,
            codigoReserva: reserva.codigo,
            dataInicio: reserva.dataInicio.toISOString(),
            dataFim: reserva.dataFim.toISOString(),
            tipo: reserva.tipo,
            quantidadePessoas: reserva.quantidadePessoas,
            quantidadeChales: reserva.quantidadeChales,
            quantidadeDiarias: reserva.quantidadeDiarias,
            valorTotal: reserva.valorTotal,
            motivoCancelamento: motivoCancelamento,
            dadosHospede: reserva.dadosHospede,
          };

          await this.emailsService.enviarReservaCancelada(emailData);
        } catch (emailError) {
          this.logger.error(
            `❌ Erro ao enviar email de reserva cancelada: ${emailError.message}`,
          );
          // Não falhar o processamento do webhook por erro de email
        }

        // Log específico para pagamentos expirados
        if (
          eventType === 'CHECKOUT_EXPIRED' ||
          eventType === 'PAYMENT_OVERDUE' ||
          (eventType === 'PAYMENT_STATUS_CHANGE' &&
            payload.status === 'OVERDUE')
        ) {
          this.logger.warn(
            `⏰ PAGAMENTO EXPIRADO - Reserva: ${reserva.codigo}, ID: ${checkoutId}, Evento: ${eventType}`,
          );
        }
      }

      // Enviar notificação por email
      try {
        const linkPagamento =
          status === StatusPagamento.PENDENTE
            ? pagamento.linkPagamento
            : undefined;

        await this.emailsService.enviarNotificacaoPagamento(
          reserva.usuarioEmail, // Usando o email armazenado diretamente na reserva
          reserva.usuarioNome, // Usando o nome armazenado diretamente na reserva
          reserva.codigo,
          status === StatusPagamento.PAGO
            ? 'pago'
            : status === StatusPagamento.CANCELADO
              ? 'cancelado'
              : 'pendente',
          linkPagamento,
        );
      } catch (emailError) {
        // Apenas registramos o erro de email, mas não interrompemos o processamento
        this.logger.error(`Erro ao enviar email: ${emailError.message}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar webhook: ${error.message}`);
      // Registrar o erro detalhado, incluindo o payload
      this.logger.error(`Payload: ${JSON.stringify(payload)}`);
      this.logger.error(`Stack trace: ${error.stack}`);

      throw new HttpException(
        'Erro ao processar webhook de pagamento',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verifica e cancela pagamentos expirados automaticamente
   * Este método pode ser chamado periodicamente para garantir que pagamentos expirados sejam cancelados
   * mesmo se o webhook não for recebido
   */
  /**
   * Tenta recriar as travas de diária (ReservaHold) de uma reserva que foi
   * cancelada automaticamente (ex.: expirou por tempo) mas cujo pagamento
   * acabou confirmado por um webhook que chegou atrasado, depois do
   * cancelamento. Se as datas ainda estiverem livres, a trava é recriada e
   * a reserva pode voltar a ser confirmada normalmente. Se alguém já
   * ocupou a data nesse intervalo (índice único do ReservaHold rejeita o
   * insert), retorna false — quem chama deve estornar o pagamento, porque
   * não há mais como cumprir a reserva.
   *
   * É uma versão simplificada da mesma lógica em
   * ReservaProcessoService.criarHoldsDeReserva (não dá pra reusar aquele
   * método direto sem criar dependência circular entre os dois serviços).
   */
  private async tentarReadquirirHolds(reserva: any): Promise<boolean> {
    const noites: Date[] = [];
    const cursor = new Date(reserva.dataInicio);
    cursor.setHours(0, 0, 0, 0);
    const quantidadeDiarias = Math.max(1, reserva.quantidadeDiarias || 1);
    for (let i = 0; i < quantidadeDiarias; i++) {
      noites.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const holds: { data: Date; recurso: string; reservaId: any }[] = [];

    if (
      reserva.tipo === TipoReserva.DIARIA ||
      reserva.tipo === TipoReserva.BATISMO ||
      reserva.tipo === TipoReserva.COMPLETO
    ) {
      for (const noite of noites) {
        holds.push({ data: noite, recurso: 'principal', reservaId: reserva._id });
      }
    }

    if (reserva.quantidadeChales && reserva.quantidadeChales > 0) {
      for (const noite of noites) {
        const ocupados = await this.reservaHoldModel
          .find({ data: noite, recurso: { $regex: /^chale-/ } }, { recurso: 1 })
          .lean();
        const numerosOcupados = new Set(
          ocupados.map((h: any) => Number(String(h.recurso).split('-')[1])),
        );
        const livres: number[] = [];
        for (let n = 1; n <= 4 && livres.length < reserva.quantidadeChales; n++) {
          if (!numerosOcupados.has(n)) livres.push(n);
        }
        if (livres.length < reserva.quantidadeChales) {
          return false;
        }
        for (const n of livres) {
          holds.push({ data: noite, recurso: `chale-${n}`, reservaId: reserva._id });
        }
      }
    }

    if (holds.length === 0) return true;

    try {
      await this.reservaHoldModel.insertMany(holds, { ordered: true });
      return true;
    } catch (error) {
      if (error?.code === 11000) return false;
      throw error;
    }
  }

  /**
   * Um pagamento chegou como confirmado (PAGO) via webhook, mas a reserva
   * já não está mais no estado que permitiria confirmá-la (foi cancelada
   * por expiração ou por outro motivo antes do webhook chegar). Em vez de
   * simplesmente aceitar o dinheiro sem entregar a reserva, tenta reaver as
   * datas; se não der, estorna automaticamente e avisa cliente e admin.
   *
   * Retorna true se a reserva pôde ser reativada (o chamador deve seguir o
   * fluxo normal de confirmação); false se foi estornada (não confirmar).
   */
  private async recuperarOuEstornarReservaCancelada(
    reserva: any,
    pagamento: any,
    eventType: string,
  ): Promise<boolean> {
    const conseguiuReadquirir = await this.tentarReadquirirHolds(reserva);

    if (conseguiuReadquirir) {
      this.logger.warn(
        `⚠️ Reserva ${reserva.codigo} estava cancelada quando o pagamento chegou confirmado (evento: ${eventType}), mas as datas ainda estavam livres — reativando.`,
      );
      return true;
    }

    this.logger.error(
      `🚨 Reserva ${reserva.codigo}: pagamento confirmado (evento: ${eventType}) mas a reserva já foi cancelada e as datas não estão mais disponíveis. Estornando automaticamente.`,
    );

    try {
      await this.processarEstornoPagamento(
        pagamento._id.toString(),
        pagamento.valorTotal,
        'Estorno automático: a reserva expirou/foi cancelada antes da confirmação do pagamento e as datas já não estavam mais disponíveis.',
      );
    } catch (estornoError) {
      // Se o estorno automático falhar, isso vira um caso que precisa de
      // intervenção manual — o dinheiro foi cobrado e a reserva não pode
      // ser cumprida. Registrar bem alto e ainda assim avisar o admin.
      this.logger.error(
        `🚨🚨 FALHA AO ESTORNAR automaticamente a reserva ${reserva.codigo}: ${estornoError.message}. Requer estorno manual pelo painel do Asaas.`,
      );
    }

    try {
      await this.emailsService.enviarNotificacaoPagamento(
        reserva.usuarioEmail,
        reserva.usuarioNome,
        reserva.codigo,
        'estornado',
      );
    } catch (emailError) {
      this.logger.error(
        `Erro ao enviar email de estorno automático: ${emailError.message}`,
      );
    }

    try {
      await this.emailsService.enviarEmail(
        'administrativo@oceanodagraca.com',
        `⚠️ Estorno automático - Reserva ${reserva.codigo}`,
        `A reserva ${reserva.codigo} (${reserva.usuarioNome}, ${reserva.usuarioEmail}) recebeu confirmação de pagamento depois de já ter sido cancelada, e as datas não estavam mais disponíveis. O valor foi estornado automaticamente. Vale conferir no painel do Asaas se o estorno realmente foi concluído.`,
      );
    } catch (emailError) {
      this.logger.error(
        `Erro ao notificar admin sobre estorno automático: ${emailError.message}`,
      );
    }

    return false;
  }

  // Antes disso só existia um endpoint admin pra chamar isso na mão —
  // nada rodava sozinho, então uma reserva com pagamento pendente que
  // ninguém nunca cancelou manualmente ficava segurando a data pra
  // sempre. Agora roda a cada 5 minutos automaticamente.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async verificarECancelarPagamentosExpirados(): Promise<void> {
    try {
      // Buscar pagamentos pendentes há mais de 30 minutos
      const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000);

      const pagamentosExpirados = await (
        this.pagamentoRepository as any
      ).findPagamentosExpirados(trintaMinutosAtras);

      if (pagamentosExpirados.length === 0) {
        return;
      }

      this.logger.warn(
        `⏰ Encontrados ${pagamentosExpirados.length} pagamentos expirados`,
      );

      for (const pagamento of pagamentosExpirados) {
        try {
          // Buscar reserva associada
          const reserva = await this.reservaRepository.findByPagamentoId(
            pagamento._id.toString(),
          );

          if (!reserva) {
            this.logger.error(
              `Reserva não encontrada para pagamento expirado: ${pagamento._id}`,
            );
            continue;
          }

          // Cancelar pagamento
          await this.pagamentoRepository.updatePagamento(
            pagamento._id.toString(),
            {
              status: StatusPagamento.CANCELADO,
              dataPagamento: new Date(),
              detalhes: {
                ...pagamento.detalhes,
                canceladoAutomaticamente: true,
                motivo: 'Pagamento expirado - Cancelamento automático',
                dataCancelamento: new Date(),
              },
            },
          );

          // Cancelar reserva
          await this.reservaRepository.atualizarStatus(
            reserva._id.toString(),
            StatusReserva.CANCELADA,
            'Pagamento expirado - Cancelamento automático após 30 minutos',
          );

          // Liberar as travas de diária — sem isso, as datas ficam
          // bloqueadas pra sempre mesmo com a reserva já cancelada.
          await this.reservaHoldModel.deleteMany({ reservaId: reserva._id });

          this.logger.warn(
            `🚨 Reserva ${reserva.codigo} cancelada automaticamente - Pagamento expirado`,
          );

          // Enviar notificação por email
          try {
            await this.emailsService.enviarNotificacaoPagamento(
              reserva.usuarioEmail,
              reserva.usuarioNome,
              reserva.codigo,
              'cancelado',
            );
          } catch (emailError) {
            this.logger.error(
              `Erro ao enviar email de cancelamento: ${emailError.message}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Erro ao cancelar pagamento expirado ${pagamento._id}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Erro na verificação de pagamentos expirados: ${error.message}`,
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
      OVERDUE: StatusPagamento.CANCELADO, // ✅ Corrigido: Pagamentos vencidos devem ser cancelados
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

  // O Asaas devolve o hóspede pra essas URLs após o checkout — sem o código
  // da reserva aqui, a tela de sucesso do front não tem como saber qual
  // reserva mostrar (só recebia "?status=sucesso", sem identificador).
  private buildCallbackUrls(codigoReserva: string) {
    const base = `${this.frontendBaseUrl}/payment-success`;
    return {
      cancelUrl: `${base}?status=cancelado&codigo=${codigoReserva}`,
      expiredUrl: `${base}?status=expirado&codigo=${codigoReserva}`,
      successUrl: `${base}?status=sucesso&codigo=${codigoReserva}`,
    };
  }

  private async buildDadosPagamento(
    reserva: Reserva,
    dadosPagamento: IDadosPagamento,
  ) {
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 3);
    const dataFormatada = dataVencimento.toISOString().split('T')[0];

    // Mapear modo de pagamento interno para formato do ASAAS
    const mapearModoPagamento = (modo: string): string => {
      switch (modo) {
        case 'PIX':
          return 'PIX';
        case 'CARTAO':
          return 'CREDIT_CARD';
        case 'BOLETO':
          return 'BOLETO';
        default:
          return modo;
      }
    };

    const modoAsaas = mapearModoPagamento(dadosPagamento.modoPagamento);

    // Preparar dados do cliente para o ASAAS
    const customerData = this.buildCustomerData(reserva);

    // Descrição principal da cobrança
    const descricaoPrincipal = `Reserva #${reserva.codigo}`;

    switch (dadosPagamento.modoPagamento) {
      case ModoPagamento.PIX:
        return {
          billingTypes: [modoAsaas],
          chargeTypes: ['DETACHED'],
          minutesToExpire: 30,
          description: descricaoPrincipal,
          callback: this.buildCallbackUrls(reserva.codigo),
          items: await this.gerarItens(reserva, dadosPagamento),
          customerData: customerData,
        };
      case ModoPagamento.CARTAO:
        if (dadosPagamento.tipoPagamento === TipoPagamento.PARCELADO) {
          return {
            billingTypes: [modoAsaas],
            chargeTypes: ['DETACHED', 'INSTALLMENT'],
            minutesToExpire: 30,
            description: descricaoPrincipal,
            callback: this.buildCallbackUrls(reserva.codigo),
            items: await this.gerarItens(reserva, dadosPagamento),
            installment: {
              maxInstallmentCount: dadosPagamento.parcelas || 12,
              defaultInstallmentCount: dadosPagamento.parcelas || 1,
            },
            customerData: customerData,
          };
        }
        return {
          billingTypes: [modoAsaas],
          chargeTypes: ['DETACHED'],
          minutesToExpire: 30,
          description: descricaoPrincipal,
          callback: this.buildCallbackUrls(reserva.codigo),
          items: await this.gerarItens(reserva, dadosPagamento),
          customerData: customerData,
        };
      default:
        'Modo de pagamento inválido';
        throw new HttpException(
          'Modo de pagamento inválido',
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  private async gerarItens(reserva: Reserva, dadosPagamento: IDadosPagamento) {
    const itens = [];

    // Padrão de descrição com código da reserva
    const descricaoPadrao = `Reserva #${reserva.codigo}`;

    // 🔍 DEBUG: Log dos dados da reserva
    const debugData = {
      tipo: reserva.tipo,
      quantidadePessoas: reserva.quantidadePessoas,
      quantidadeChales: reserva.quantidadeChales,
      quantidadeDiarias: reserva.quantidadeDiarias,
      dataInicio: reserva.dataInicio,
      dataFim: reserva.dataFim,
      codigo: reserva.codigo,
    };

    switch (reserva.tipo) {
      case 'diaria':
        // Item base para a diária
        itens.push({
          name: reserva.quantidadeDiarias > 1 ? 'Diárias' : 'Diária',
          description: `${descricaoPadrao} - Diária para ${reserva.quantidadePessoas} pessoas`,
          quantity: reserva.quantidadeDiarias,
          value: dadosPagamento.valorDiaria,
        });

        // Se tiver chalés adicionais, mostrar como item separado
        if (reserva.quantidadeChales && reserva.quantidadeChales > 0) {
          // Calcular valor do chalé por dia baseado no preço configurado
          const config = await this.configuracoesRepository.findAll();
          const valorChalePorDia = config.precoChale;

          itens.push({
            name: 'Chalés',
            description: `${descricaoPadrao} - ${
              reserva.quantidadeChales > 1
                ? `${reserva.quantidadeChales} chalés adicionais por ${reserva.quantidadeDiarias} dia(s)`
                : `${reserva.quantidadeChales} chalé adicional por ${reserva.quantidadeDiarias} dia(s)`
            }`,
            quantity: reserva.quantidadeChales * reserva.quantidadeDiarias,
            value: valorChalePorDia,
          });
        }
        break;

      case 'chale':
        itens.push({
          name: 'Chalés',
          description: `${descricaoPadrao} - ${reserva.quantidadeChales} chalé(s) por ${reserva.quantidadeDiarias} dia(s)`,
          quantity: reserva.quantidadeChales, // Já incluímos o cálculo na description
          value: dadosPagamento.valorDiaria,
        });
        break;

      case 'batismo':
        itens.push({
          name: 'Batismo',
          description: `${descricaoPadrao} - Serviço de batismo para ${reserva.quantidadePessoas} pessoas`,
          quantity: 1,
          value: dadosPagamento.valorTotal,
        });
        break;
    }

    // 🔍 DEBUG: Log dos itens gerados
    const debugItens = itens;
    return itens;
  }

  /**
   * Constrói os dados do cliente para o ASAAS baseado nos dados da reserva
   */
  private buildCustomerData(reserva: Reserva): any {
    const customerData: any = {};

    // Nome completo (nome + sobrenome)
    if (reserva.dadosHospede?.nome && reserva.dadosHospede?.sobrenome) {
      customerData.name = `${reserva.dadosHospede.nome} ${reserva.dadosHospede.sobrenome}`;
    } else if (reserva.usuarioNome) {
      customerData.name = reserva.usuarioNome;
    }

    // CPF (se disponível nos dados do hóspede)
    if (reserva.dadosHospede?.cpf) {
      // Limpar formatação do CPF
      customerData.cpfCnpj = reserva.dadosHospede.cpf.replace(/\D/g, '');
    }

    // Email (priorizar dados do hóspede, senão usar email do usuário)
    if (reserva.dadosHospede?.email) {
      customerData.email = reserva.dadosHospede.email;
    } else if (reserva.usuarioEmail) {
      customerData.email = reserva.usuarioEmail;
    }

    // Telefone (se disponível nos dados do hóspede)
    if (reserva.dadosHospede?.telefone) {
      // Limpar formatação do telefone
      customerData.phone = reserva.dadosHospede.telefone.replace(/\D/g, '');
    }

    // Endereço (se disponível nos dados do hóspede)
    if (reserva.dadosHospede?.endereco) {
      customerData.address = reserva.dadosHospede.endereco;
    } else {
    }

    if (reserva.dadosHospede?.numero) {
      customerData.addressNumber = reserva.dadosHospede.numero;
    }

    if (reserva.dadosHospede?.cep) {
      customerData.postalCode = reserva.dadosHospede.cep.replace(/\D/g, '');
    }

    // Bairro (province no ASAAS)
    if (reserva.dadosHospede?.bairro) {
      customerData.province = reserva.dadosHospede.bairro;
    }

    // Cidade
    if (reserva.dadosHospede?.cidade) {
      customerData.city = reserva.dadosHospede.cidade;
    }

    // Estado/UF (state no ASAAS)
    if (reserva.dadosHospede?.uf) {
      customerData.state = reserva.dadosHospede.uf;
    } else {
    }

    // Retornar apenas os campos que foram preenchidos
    return Object.keys(customerData).length > 0 ? customerData : undefined;
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
   * Processar estorno de pagamento via ASAAS
   */
  async processarEstornoPagamento(
    pagamentoId: string,
    valor?: number,
    descricao?: string,
  ): Promise<any> {
    try {
      // 1. Buscar dados do pagamento
      const pagamento = await this.pagamentoRepository.findById(pagamentoId);
      if (!pagamento) {
        throw new NotFoundException('Pagamento não encontrado');
      }

      // 2. Verificar se pode ser estornado
      await this.validarElegibilidadeEstorno(pagamento);

      // 3. Determinar endpoint baseado no tipo de pagamento
      const endpoint = this.determinarEndpointEstorno(pagamento);

      // 4. Processar estorno via ASAAS
      const estorno = await this.chamarApiEstorno(
        endpoint,
        pagamento,
        valor,
        descricao,
      );

      // 5. Atualizar status do pagamento
      //
      // O estorno de parcelamento no ASAAS não é necessariamente síncrono:
      // a resposta pode voltar como PENDING ou aguardando autorização, não
      // só DONE (ver docs.asaas.com/reference/refund-installment). Só
      // marcamos o pagamento como ESTORNADO quando o ASAAS já confirmou
      // "DONE" — do contrário ficaríamos dizendo pro admin e pro cliente
      // que o dinheiro já voltou quando na verdade ainda está em
      // processamento (pode levar até 10 dias úteis para cair no cartão).
      // Estornos de PIX/pagamento avulso (não-parcelado) sempre voltam
      // como DONE de forma síncrona, então isso não muda o comportamento
      // pra eles.
      const estornoConcluido = !estorno.status || estorno.status === 'DONE';
      await this.pagamentoRepository.updatePagamento(pagamentoId, {
        ...(estornoConcluido ? { status: StatusPagamento.ESTORNADO } : {}),
        estorno: {
          id: estorno.id,
          valor: estorno.value || estorno.valor || 0,
          dataEstorno: new Date(estorno.dateCreated || new Date()),
          status: estorno.status || 'DONE',
          descricao: estorno.description || descricao,
        },
      });

      // Retornar dados padronizados
      return {
        id: estorno.id,
        value: estorno.value || estorno.valor || 0,
        valor: estorno.value || estorno.valor || 0,
        dateCreated: estorno.dateCreated || new Date().toISOString(),
        dataEstorno: new Date(estorno.dateCreated || new Date()),
        status: estorno.status || 'ESTORNADO',
        description: estorno.description || descricao,
      };
    } catch (error) {
      this.logger.error(`Erro ao processar estorno: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determinar endpoint de estorno baseado no tipo de pagamento
   *
   * Nota: `pagamento.tipoPagamento` e `pagamento.parcelas` nunca são
   * persistidos na criação da cobrança (ver criarCobranca) - apenas
   * `qtdParcelas` é gravado. Por isso a decisão usa `qtdParcelas`, o único
   * campo realmente populado para pagamentos parcelados.
   */
  private determinarEndpointEstorno(pagamento: any): string {
    // Se for parcelamento (cartão parcelado)
    if (pagamento.qtdParcelas && pagamento.qtdParcelas > 1) {
      if (!pagamento.asaasInstallmentId) {
        throw new BadRequestException(
          'ID do parcelamento ASAAS não encontrado',
        );
      }
      return `/v3/installments/${pagamento.asaasInstallmentId}/refund`;
    }

    // Se for cobrança simples (PIX, cartão à vista, boleto).
    //
    // IMPORTANTE: `asaasCheckoutSessionId` é o ID da Checkout Session
    // (gravado na criação da cobrança, ver criarCobranca) — não existe um "payment" de
    // verdade na Asaas até o cliente efetivamente pagar. O ID do pagamento
    // real só chega depois, via webhook, em `asaasPaymentId`
    // (processarWebhook seta isso a partir de payload.payment.id). Chamar
    // /v3/payments/{id}/refund com o ID da checkout session em vez do ID
    // do pagamento retorna 404 da Asaas — o estorno nunca acontecia de
    // verdade, só falhava silenciosamente e a reserva era cancelada mesmo
    // assim. Como só chegamos aqui pra pagamento já PAGO/CONFIRMADO/
    // RECEBIDO, asaasPaymentId já deve estar preenchido.
    if (!pagamento.asaasPaymentId) {
      throw new BadRequestException(
        'ID do pagamento ASAAS (asaasPaymentId) não encontrado — não é possível estornar sem ele.',
      );
    }
    return `/v3/payments/${pagamento.asaasPaymentId}/refund`;
  }

  /**
   * Chamar API de estorno da ASAAS
   */
  private async chamarApiEstorno(
    endpoint: string,
    pagamento: any,
    valor?: number,
    descricao?: string,
  ): Promise<any> {
    const dadosEstorno = {
      value: valor,
      description: descricao || `Estorno da reserva - ${pagamento.reservaId}`,
      scheduleDate: new Date().toISOString(),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}${endpoint}`, dadosEstorno, {
          headers: {
            access_token: this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: ASAAS_TIMEOUT_MS,
        }),
      );

      return response.data;
    } catch (error) {
      // Detalhe técnico completo (endpoint, método, ID real usado, status e
      // corpo da resposta do Asaas) só é usado aqui dentro pra montar o
      // `asaasError` — nunca inclui a access_token/API key, que fica de
      // fora de propósito. Esse objeto sobe até o admin (endpoint protegido
      // por JwtAuthGuard+AdminGuard) pra ele diagnosticar sem precisar ir
      // no log do servidor; o cliente final nunca chega nesse fluxo, pois
      // estorno só acontece via cancelamento feito pelo admin.
      const asaasErrorDetails: AsaasErrorDetails = {
        method: 'POST',
        endpoint: `${this.apiUrl}${endpoint}`,
        httpStatus: error.response?.status ?? null,
        asaasResponse: error.response?.data ?? null,
        originalMessage: error.message,
      };

      this.logger.error(
        `❌ Erro na API ASAAS [POST ${asaasErrorDetails.endpoint}] (status ${asaasErrorDetails.httpStatus}): ${JSON.stringify(asaasErrorDetails.asaasResponse ?? error.message)}`,
      );

      throw new BadRequestException({
        message: `Erro ao processar estorno via ASAAS: ${error.response?.data?.errors?.[0]?.description || error.response?.data?.message || error.message}`,
        asaasError: asaasErrorDetails,
      });
    }
  }

  /**
   * Validar elegibilidade para estorno
   */
  private async validarElegibilidadeEstorno(pagamento: any): Promise<void> {
    // Verificar se pagamento foi confirmado
    if (
      pagamento.status !== StatusPagamento.CONFIRMADO &&
      pagamento.status !== StatusPagamento.RECEBIDO &&
      pagamento.status !== StatusPagamento.PAGO
    ) {
      this.logger.error(`❌ Status inválido para estorno: ${pagamento.status}`);
      throw new BadRequestException(
        `Pagamento não pode ser estornado - Status inválido: ${pagamento.status}`,
      );
    }

    // Verificar se já foi estornado
    if (pagamento.status === StatusPagamento.ESTORNADO) {
      throw new BadRequestException('Pagamento já foi estornado');
    }

    // Verificar prazo para estorno
    if (pagamento.dataPagamento) {
      const dataPagamento = new Date(pagamento.dataPagamento);
      const hoje = new Date();
      const diasDiferenca = Math.floor(
        (hoje.getTime() - dataPagamento.getTime()) / (1000 * 60 * 60 * 24),
      );

      // PIX: até 90 dias
      if (pagamento.modoPagamento === ModoPagamento.PIX && diasDiferenca > 90) {
        throw new BadRequestException(
          'PIX não pode ser estornado após 90 dias',
        );
      }

      // Cartão de crédito: até 180 dias
      // (o valor persistido em pagamento.modoPagamento é CARTAO, não
      // CREDIT_CARD - este último só existe como billingType enviado ao
      // ASAAS. Comparar com CREDIT_CARD fazia essa checagem nunca disparar.)
      if (
        pagamento.modoPagamento === ModoPagamento.CARTAO &&
        diasDiferenca > 180
      ) {
        throw new BadRequestException(
          'Cartão de crédito não pode ser estornado após 180 dias',
        );
      }

      // Boleto: não elegível para estorno
      if (pagamento.modoPagamento === ModoPagamento.BOLETO) {
        throw new BadRequestException(
          'Boleto não é elegível para estorno automático',
        );
      }
    }
  }
}
