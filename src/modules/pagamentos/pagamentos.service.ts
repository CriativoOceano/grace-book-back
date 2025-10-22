import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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
import { ReservaEmailData } from '../emails/templates/reserva-confirmacao.template';
import { CONFIGURACOES_REPOSITORY } from '../configuracoes/repositories/configuracaoes-repository.provider';
import { IConfiguracoesRepository } from '../configuracoes/repositories/interfaces/reserva-repository.interface';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
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
      this.logger.log('🔄 Executando migração de dados de pagamentos...');
      await this.pagamentoRepository.migrarDadosExistentes();
      this.logger.log('✅ Migração de dados concluída com sucesso');
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

  private writeLogToFile(message: string) {
    try {
      const logPath = path.join(process.cwd(), 'asaas-debug.log');
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch (error) {
      console.error('Erro ao escrever log:', error);
    }
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
        this.httpService.get(
          `${this.apiUrl}/customers?cpfCnpj=${cpfLimpo}`,
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
      const dadosCliente = {
        name: usuario.nome,
        cpfCnpj: cpfLimpo, // Usar CPF limpo (sem formatação)
        mobilePhone: usuario.telefone,
        email: usuario.email,
        notificationDisabled: false,
      };
      
      this.logger.log(`Criando cliente no ASAAS: ${JSON.stringify(dadosCliente)}`);
      
      const novoCliente = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/customers`,
          dadosCliente,
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
      
      // Escrever logs detalhados em arquivo
      this.writeLogToFile(`=== ERRO AO CRIAR/RECUPERAR CLIENTE ===`);
      this.writeLogToFile(`Erro: ${error.message || error}`);
      
      // Log detalhado do erro
      if (error.response) {
        this.writeLogToFile(`Status HTTP: ${error.response.status}`);
        this.writeLogToFile(`Data da resposta: ${JSON.stringify(error.response.data, null, 2)}`);
        this.writeLogToFile(`Headers da resposta: ${JSON.stringify(error.response.headers, null, 2)}`);
        this.writeLogToFile(`URL da requisição: ${error.config?.url || 'N/A'}`);
        this.writeLogToFile(`Método: ${error.config?.method || 'N/A'}`);
        this.writeLogToFile(`Headers da requisição: ${JSON.stringify(error.config?.headers, null, 2)}`);
        this.writeLogToFile(`Dados enviados: ${JSON.stringify(error.config?.data, null, 2)}`);
      }
      
      this.writeLogToFile(`Dados do usuário: ${JSON.stringify(usuario, null, 2)}`);
      this.writeLogToFile(`=== FIM DO LOG DE ERRO ===`);
      
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
  ): Promise<any> {
    // Verificar se já existe cobrança para esta reserva (idempotência)
    const reserva: Reserva = await this.reservaRepository.findById(reservaId);
    
    // Verificar se já existe pagamento para esta reserva
    const pagamentosExistentes = await this.pagamentoRepository.findByReservaId(reservaId);
    
    if (pagamentosExistentes && pagamentosExistentes.length > 0) {
      const pagamentoExistente = pagamentosExistentes[0];
      
      if (pagamentoExistente.asaasPagamentoId && pagamentoExistente.status !== StatusPagamento.CANCELADO) {
        this.logger.log(`Cobrança já existe para reserva ${reservaId}, retornando dados existentes`);
        
        // Consultar status atual no ASAAS
        try {
          const statusPagamento = await this.consultarStatusCobranca(reservaId);
          return {
            asaasId: pagamentoExistente.asaasPagamentoId,
            status: statusPagamento.status,
            valor: statusPagamento.valor,
            linkPagamento: statusPagamento.linkPagamento,
          };
        } catch (error) {
          // Se não conseguir consultar o status, retornar dados do banco
          this.logger.warn(`Não foi possível consultar status da cobrança ${pagamentoExistente.asaasPagamentoId}, retornando dados do banco`);
          return {
            asaasId: pagamentoExistente.asaasPagamentoId,
            status: pagamentoExistente.status,
            valor: pagamentoExistente.valorTotal,
            linkPagamento: pagamentoExistente.linkPagamento,
          };
        }
      }
    }

    // Verificar se já existe cobrança no ASAAS pela chave de idempotência ANTES de tentar criar
    const idempotencyKey = uuidv4(); // Gerar UUID único para esta tentativa de cobrança
    this.logger.log(`Gerando chave de idempotência UUID: ${idempotencyKey}`);
    
    // Verificar se já existe cobrança no ASAAS pela chave de idempotência
    try {
      const buscaPrevia = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/checkouts?externalReference=${idempotencyKey}`,
          {
            headers: {
              access_token: this.apiKey,
            },
          },
        ),
      );
      
      if (buscaPrevia.data.data && buscaPrevia.data.data.length > 0) {
        const checkoutExistente = buscaPrevia.data.data[0];
        this.logger.log(`Cobrança já existe no ASAAS: ${checkoutExistente.id}`);
        
        // Criar registro de pagamento no banco se não existir
        if (!pagamentosExistentes || pagamentosExistentes.length === 0) {
          this.logger.log(`Criando registro de pagamento para cobrança existente: ${checkoutExistente.id}`);
          await this.pagamentoRepository.createPagamento({
            reservaId: reserva,
            status: StatusPagamento.PENDENTE,
            asaasPagamentoId: checkoutExistente.id, // Checkout Session ID
            asaasCheckoutSessionId: checkoutExistente.id, // Checkout Session ID
            valorTotal: dadosPagamento.valorTotal,
            linkPagamento: checkoutExistente.link,
            modoPagamento: dadosPagamento.modoPagamento,
            qtdParcelas: dadosPagamento.parcelas,
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
      this.logger.log(`Nenhuma cobrança encontrada no ASAAS para chave: ${idempotencyKey}`);
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
      // console.log(valorTotaldaReserva); return
      dadosPagamento.valorDiaria = valorTotaldaReserva.valorDiaria;
      dadosPagamento.valorDiariaComChale =
        valorTotaldaReserva.valorDiariaComChale;
      dadosPagamento.valorTotal = valorTotaldaReserva.valorTotal;

      const dadosCobranca = await this.buildDadosPagamento(reserva, dadosPagamento);

      console.log(dadosCobranca, 'DADOS COBRANCA');
      
      // Usar UUID como chave de idempotência
      (dadosCobranca as any).externalId = idempotencyKey;
      
      this.logger.log(`Criando cobrança no ASAAS: ${JSON.stringify(dadosCobranca)}`);
      
      const cobranca = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/checkouts`,
          dadosCobranca,
          {
            headers: {
              access_token: this.apiKey,
              'Idempotency-Key': idempotencyKey, // Header para idempotência
            },
          },
        ),
      );

      const cobrancaCriada = await this.pagamentoRepository.createPagamento({
        reservaId: reserva,
        status: StatusPagamento.PENDENTE,
        asaasPagamentoId: cobranca.data.id, // Checkout Session ID
        asaasCheckoutSessionId: cobranca.data.id, // Checkout Session ID
        valorTotal: dadosPagamento.valorTotal,
        linkPagamento: cobranca.data.link,
        modoPagamento: dadosPagamento.modoPagamento,
        qtdParcelas: dadosPagamento.parcelas,
        detalhes: cobranca.data,
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
      
      // Verificar se é erro de idempotência (cobrança já existe)
      if (error.response?.status === 409 || 
          error.response?.data?.errors?.some((e: any) => e.code === 'DUPLICATE_EXTERNAL_ID')) {
        this.logger.log(`Cobrança já existe para reserva ${reservaId}, retornando dados existentes`);
        
        // Aguardar um pouco para garantir que a primeira requisição tenha terminado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Buscar cobrança existente novamente
        const cobrancaExistente = await this.pagamentoRepository.findByReservaId(reservaId);
        if (cobrancaExistente && cobrancaExistente.length > 0) {
          const pagamento = cobrancaExistente[0];
          
          // Se ainda não tem asaasPagamentoId, aguardar mais um pouco
          if (!pagamento.asaasPagamentoId) {
            this.logger.log(`Pagamento encontrado mas sem asaasPagamentoId, aguardando...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Buscar novamente
            const cobrancaAtualizada = await this.pagamentoRepository.findByReservaId(reservaId);
            if (cobrancaAtualizada && cobrancaAtualizada.length > 0 && cobrancaAtualizada[0].asaasPagamentoId) {
              const pagamentoAtualizado = cobrancaAtualizada[0];
              return {
                asaasId: pagamentoAtualizado.asaasPagamentoId,
                status: pagamentoAtualizado.status,
                valor: pagamentoAtualizado.valorTotal,
                linkPagamento: pagamentoAtualizado.linkPagamento,
              };
            }
          }
          
          return {
            asaasId: pagamento.asaasPagamentoId,
            status: pagamento.status,
            valor: pagamento.valorTotal,
            linkPagamento: pagamento.linkPagamento,
          };
        }
        
        // Se ainda não encontrou, tentar buscar pela chave de idempotência
        this.logger.log(`Tentando buscar cobrança pela chave de idempotência: ${idempotencyKey}`);
        
        // Buscar no ASAAS pela chave de idempotência
        try {
          const buscaAsaas = await firstValueFrom(
            this.httpService.get(
              `${this.apiUrl}/checkouts?externalReference=${idempotencyKey}`,
              {
                headers: {
                  access_token: this.apiKey,
                },
              },
            ),
          );
          
          if (buscaAsaas.data.data && buscaAsaas.data.data.length > 0) {
            const checkoutExistente = buscaAsaas.data.data[0];
            this.logger.log(`Cobrança encontrada no ASAAS: ${checkoutExistente.id}`);
            
            // Criar registro de pagamento no banco se não existir
            const pagamentoExistente = await this.pagamentoRepository.findByReservaId(reservaId);
            if (!pagamentoExistente || pagamentoExistente.length === 0) {
              this.logger.log(`Criando registro de pagamento para cobrança existente: ${checkoutExistente.id}`);
              await this.pagamentoRepository.createPagamento({
                reservaId: reserva,
                status: StatusPagamento.PENDENTE,
                asaasPagamentoId: checkoutExistente.id, // Checkout Session ID
                asaasCheckoutSessionId: checkoutExistente.id, // Checkout Session ID
                valorTotal: dadosPagamento.valorTotal,
                linkPagamento: checkoutExistente.link,
                modoPagamento: dadosPagamento.modoPagamento,
                qtdParcelas: dadosPagamento.parcelas,
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
          this.logger.warn(`Erro ao buscar cobrança no ASAAS: ${buscaError.message}`);
          
          // Se a busca falhou, retornar erro mais específico
          if (buscaError.response?.status === 404) {
            this.logger.error(`Cobrança não encontrada no ASAAS para chave: ${idempotencyKey}`);
            throw new HttpException(
              'Cobrança não encontrada no sistema de pagamento. Tente novamente.',
              HttpStatus.NOT_FOUND,
            );
          }
        }
      }
      
      // Escrever logs detalhados em arquivo
      this.writeLogToFile(`=== ERRO AO CRIAR COBRANÇA ===`);
      this.writeLogToFile(`Erro: ${error.message || error}`);
      
      // Log detalhado do erro
      if (error.response) {
        this.writeLogToFile(`Status HTTP: ${error.response.status}`);
        this.writeLogToFile(`Data da resposta: ${JSON.stringify(error.response.data, null, 2)}`);
        this.writeLogToFile(`Headers da resposta: ${JSON.stringify(error.response.headers, null, 2)}`);
        this.writeLogToFile(`URL da requisição: ${error.config?.url || 'N/A'}`);
        this.writeLogToFile(`Método: ${error.config?.method || 'N/A'}`);
        this.writeLogToFile(`Headers da requisição: ${JSON.stringify(error.config?.headers, null, 2)}`);
        this.writeLogToFile(`Dados enviados: ${JSON.stringify(error.config?.data, null, 2)}`);
      }
      
      // Log da requisição que causou o erro (se possível)
      try {
        const reservaParaLog = await this.reservaRepository.findById(reservaId);
        const dadosRequisicao = await this.buildDadosPagamento(reservaParaLog, dadosPagamento);
        this.writeLogToFile(`Dados da requisição para ASAAS: ${JSON.stringify(dadosRequisicao, null, 2)}`);
        this.writeLogToFile(`Dados do usuário da reserva: ${JSON.stringify(reservaParaLog.usuario, null, 2)}`);
        this.writeLogToFile(`Dados do pagamento: ${JSON.stringify(dadosPagamento, null, 2)}`);
      } catch (logError) {
        this.writeLogToFile(`Erro ao obter dados da reserva para log: ${logError.message}`);
      }
      
      this.writeLogToFile(`=== FIM DO LOG DE ERRO ===`);
      
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
      this.logger.log(`🔄 PROCESSANDO WEBHOOK ASAAS`);
      this.logger.log(`📋 Payload: ${JSON.stringify(payload, null, 2)}`);

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
            dataPagamento = payload.dateCreated ? new Date(payload.dateCreated) : new Date();
            break;
          case 'CHECKOUT_EXPIRED':
            status = StatusPagamento.CANCELADO; // ✅ Cancelar quando checkout expira
            this.logger.warn(`🚨 CHECKOUT EXPIRADO - Cancelando reserva: ${checkoutId}`);
            break;
          case 'CHECKOUT_CANCELED':
            status = StatusPagamento.CANCELADO;
            break;
          default:
            this.logger.log(`Evento de checkout desconhecido: ${eventType}`);
            return;
        }
      }
      // Verificar se é payload de payment (formato mais antigo)
      else if (payload.event && payload.payment) {
        // Priorizar checkoutSession se disponível, senão usar payment.id
        checkoutId = payload.payment.checkoutSession || payload.payment.id;
        eventType = payload.event;
        
        this.logger.log(`Webhook de payment - CheckoutSession: ${payload.payment.checkoutSession}, Payment ID: ${payload.payment.id}`);
        
        switch (eventType) {
          case 'PAYMENT_RECEIVED':
          case 'PAYMENT_CONFIRMED':
            status = StatusPagamento.PAGO;
            dataPagamento = payload.payment.paymentDate ? new Date(payload.payment.paymentDate) : new Date();
            break;
          case 'PAYMENT_OVERDUE':
            status = StatusPagamento.CANCELADO; // ✅ Cancelar quando pagamento vence
            this.logger.warn(`🚨 PAGAMENTO VENCIDO - Cancelando reserva: ${checkoutId}`);
            break;
          case 'PAYMENT_DELETED':
          case 'PAYMENT_REFUNDED':
            status = StatusPagamento.CANCELADO;
            break;
          default:
            this.logger.log(`Evento de payment desconhecido: ${eventType}`);
            return;
        }
      }
      // Verificar se é payload direto de payment (formato mais simples)
      else if (payload.id && payload.status) {
        checkoutId = payload.id;
        eventType = 'PAYMENT_STATUS_CHANGE';
        status = this.mapearStatusAsaas(payload.status);
        dataPagamento = payload.paymentDate ? new Date(payload.paymentDate) : new Date();
      }
      else {
        this.logger.error(`Payload de webhook inválido: ${JSON.stringify(payload)}`);
        throw new Error('Payload de webhook inválido - formato não reconhecido');
      }

      if (!checkoutId) {
        throw new Error('ID de checkout/payment não encontrado no payload');
      }

      this.logger.log(`Processando webhook - ID: ${checkoutId}, Evento: ${eventType}, Status: ${status}`);

      // Buscar pagamento por qualquer ID do ASAAS (checkout session ou payment)
      let pagamento = await this.pagamentoRepository.findByAsaasId(checkoutId);
      console.log('Pagamento encontrado:', pagamento);
      
      // Se não encontrou e é um webhook de payment, tentar buscar pelo checkoutSession
      if (!pagamento && payload.payment?.checkoutSession && payload.payment?.id) {
        this.logger.log(`Tentando buscar pelo checkoutSession: ${payload.payment.checkoutSession}`);
        pagamento = await this.pagamentoRepository.findByCheckoutSessionId(payload.payment.checkoutSession);
        
        if (pagamento) {
          this.logger.log(`Pagamento encontrado pelo checkoutSession: ${payload.payment.checkoutSession}`);
        }
      }
      
      if (!pagamento) {
        this.logger.error(`Pagamento não encontrado para o ID: ${checkoutId}`);
        this.logger.error(`Tentando buscar por diferentes campos...`);
        
        // Log de debug para entender o que está acontecendo
        const checkoutSessionSearch = await this.pagamentoRepository.findByCheckoutSessionId(checkoutId);
        const paymentIdSearch = await this.pagamentoRepository.findByPaymentId(checkoutId);
        const externalIdSearch = await this.pagamentoRepository.findByExternalId(checkoutId);
        
        this.logger.error(`Busca por checkoutSessionId: ${checkoutSessionSearch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
        this.logger.error(`Busca por paymentId: ${paymentIdSearch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
        this.logger.error(`Busca por externalId: ${externalIdSearch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
        
        // Se temos ambos os IDs no payload, tentar buscar pelo outro
        if (payload.payment?.checkoutSession && payload.payment?.id) {
          this.logger.error(`Tentando busca alternativa pelo checkoutSession: ${payload.payment.checkoutSession}`);
          const altSearch = await this.pagamentoRepository.findByCheckoutSessionId(payload.payment.checkoutSession);
          this.logger.error(`Busca alternativa por checkoutSession: ${altSearch ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
        }
        
        throw new Error(
          `Pagamento não encontrado para o ID: ${checkoutId}`,
        );
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

      // Atualizar status do pagamento e salvar Payment ID se necessário
      const updateData: any = {
        status,
        dataPagamento,
        detalhes: payload,
      };

      // Se o webhook contém um Payment ID e ainda não foi salvo, salvar agora
      if (payload.payment?.id && !pagamento.asaasPaymentId) {
        updateData.asaasPaymentId = payload.payment.id;
        this.logger.log(`Salvando Payment ID: ${payload.payment.id} para o pagamento ${pagamento._id}`);
      }

      await this.pagamentoRepository.updatePagamento(pagamento._id.toString(), updateData);

      // Atualizar status da reserva com detalhes específicos
      if (status === StatusPagamento.PAGO) {
        await this.reservaRepository.atualizarStatus(
          reserva._id.toString(),
          StatusReserva.CONFIRMADA,
          `Pagamento confirmado via ASAAS - Evento: ${eventType}`,
        );
        this.logger.log(`✅ Reserva ${reserva.codigo} confirmada - Pagamento processado`);

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
            dadosHospede: reserva.dadosHospede
          };

          await this.emailsService.enviarEmailReservaConfirmada(emailData);
          this.logger.log(`✅ Email de confirmação de pagamento enviado para ${reserva.usuarioEmail}`);
        } catch (emailError) {
          this.logger.error(`❌ Erro ao enviar email de confirmação: ${emailError.message}`);
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
          motivoCancelamento = 'Pagamento vencido - Não foi processado no prazo';
        } else if (eventType === 'PAYMENT_STATUS_CHANGE' && payload.status === 'OVERDUE') {
          motivoCancelamento = 'Pagamento vencido - Status alterado para OVERDUE';
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
        
        this.logger.warn(`🚨 Reserva ${reserva.codigo} cancelada - Motivo: ${motivoCancelamento}`);
        
        // Log específico para pagamentos expirados
        if (eventType === 'CHECKOUT_EXPIRED' || eventType === 'PAYMENT_OVERDUE' || 
            (eventType === 'PAYMENT_STATUS_CHANGE' && payload.status === 'OVERDUE')) {
          this.logger.warn(`⏰ PAGAMENTO EXPIRADO - Reserva: ${reserva.codigo}, ID: ${checkoutId}, Evento: ${eventType}`);
        }
      }

      // Enviar notificação por email
      try {
        await this.emailsService.enviarNotificacaoPagamento(
          reserva.usuarioEmail, // Usando o email armazenado diretamente na reserva
          reserva.usuarioNome, // Usando o nome armazenado diretamente na reserva
          reserva.codigo,
          status === StatusPagamento.PAGO
            ? 'pago'
            : status === StatusPagamento.CANCELADO
              ? 'cancelado'
              : 'pendente',
        );
      } catch (emailError) {
        // Apenas registramos o erro de email, mas não interrompemos o processamento
        this.logger.error(`Erro ao enviar email: ${emailError.message}`);
      }

      this.logger.log(
        `Webhook processado com sucesso: ${reserva.codigo}, status: ${status}`,
      );
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
  async verificarECancelarPagamentosExpirados(): Promise<void> {
    try {
      this.logger.log('🔄 Verificando pagamentos expirados...');
      
      // Buscar pagamentos pendentes há mais de 30 minutos
      const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000);
      
      const pagamentosExpirados = await (this.pagamentoRepository as any).findPagamentosExpirados(trintaMinutosAtras);
      
      if (pagamentosExpirados.length === 0) {
        this.logger.log('✅ Nenhum pagamento expirado encontrado');
        return;
      }
      
      this.logger.warn(`⏰ Encontrados ${pagamentosExpirados.length} pagamentos expirados`);
      
      for (const pagamento of pagamentosExpirados) {
        try {
          // Buscar reserva associada
          const reserva = await this.reservaRepository.findByPagamentoId(pagamento._id.toString());
          
          if (!reserva) {
            this.logger.error(`Reserva não encontrada para pagamento expirado: ${pagamento._id}`);
            continue;
          }
          
          // Cancelar pagamento
          await this.pagamentoRepository.updatePagamento(pagamento._id.toString(), {
            status: StatusPagamento.CANCELADO,
            dataPagamento: new Date(),
            detalhes: {
              ...pagamento.detalhes,
              canceladoAutomaticamente: true,
              motivo: 'Pagamento expirado - Cancelamento automático',
              dataCancelamento: new Date()
            }
          });
          
          // Cancelar reserva
          await this.reservaRepository.atualizarStatus(
            reserva._id.toString(),
            StatusReserva.CANCELADA,
            'Pagamento expirado - Cancelamento automático após 30 minutos'
          );
          
          this.logger.warn(`🚨 Reserva ${reserva.codigo} cancelada automaticamente - Pagamento expirado`);
          
          // Enviar notificação por email
          try {
            await this.emailsService.enviarNotificacaoPagamento(
              reserva.usuarioEmail,
              reserva.usuarioNome,
              reserva.codigo,
              'cancelado'
            );
          } catch (emailError) {
            this.logger.error(`Erro ao enviar email de cancelamento: ${emailError.message}`);
          }
          
        } catch (error) {
          this.logger.error(`Erro ao cancelar pagamento expirado ${pagamento._id}: ${error.message}`);
        }
      }
      
      this.logger.log(`✅ Verificação de pagamentos expirados concluída`);
      
    } catch (error) {
      this.logger.error(`Erro na verificação de pagamentos expirados: ${error.message}`);
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
        case 'PIX': return 'PIX';
        case 'CARTAO': return 'CREDIT_CARD';
        case 'BOLETO': return 'BOLETO';
        default: return modo;
      }
    };

    const modoAsaas = mapearModoPagamento(dadosPagamento.modoPagamento);

    // Preparar dados do cliente para o ASAAS
    const customerData = this.buildCustomerData(reserva);

    switch (dadosPagamento.modoPagamento) {
      case ModoPagamento.PIX:
        return {
          billingTypes: [modoAsaas],
          chargeTypes: ['DETACHED'],
          minutesToExpire: 15,
          callback: {
            cancelUrl: `${this.frontendBaseUrl}/payment-success?status=cancelado`,
            expiredUrl: `${this.frontendBaseUrl}/payment-success?status=expirado`,
            successUrl: `${this.frontendBaseUrl}/payment-success?status=sucesso`,
          },
          items: await this.gerarItens(reserva, dadosPagamento),
          customerData: customerData,
        };
      case ModoPagamento.CARTAO:
        if (dadosPagamento.tipoPagamento === TipoPagamento.PARCELADO) {
          return {
            billingTypes: [modoAsaas],
            chargeTypes: ['DETACHED', 'INSTALLMENT'],
            minutesToExpire: 10,
            callback: {
              cancelUrl: `${this.frontendBaseUrl}/payment-success?status=cancelado`,
              expiredUrl: `${this.frontendBaseUrl}/payment-success?status=expirado`,
              successUrl: `${this.frontendBaseUrl}/payment-success?status=sucesso`,
            },
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
          minutesToExpire: 10,
          callback: {
            cancelUrl: `${this.frontendBaseUrl}/payment-success?status=cancelado`,
            expiredUrl: `${this.frontendBaseUrl}/payment-success?status=expirado`,
            successUrl: `${this.frontendBaseUrl}/payment-success?status=sucesso`,
          },
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

    // 🔍 DEBUG: Log dos dados da reserva
    console.log('🔍 DEBUG - Dados da reserva para gerar itens:', {
      tipo: reserva.tipo,
      quantidadePessoas: reserva.quantidadePessoas,
      quantidadeChales: reserva.quantidadeChales,
      quantidadeDiarias: reserva.quantidadeDiarias,
      dataInicio: reserva.dataInicio,
      dataFim: reserva.dataFim
    });

    switch (reserva.tipo) {
      case 'diaria':
        // Item base para a diária
        itens.push({
          name:  reserva.quantidadeDiarias > 1 ? 'Diárias' : 'Diária',
          description: `Diária para ${reserva.quantidadePessoas} pessoas`,
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
            description: reserva.quantidadeChales > 1 ? `${reserva.quantidadeChales} chalés adicionais por ${reserva.quantidadeDiarias} dia(s)` 
              : `${reserva.quantidadeChales} chalé adicional por ${reserva.quantidadeDiarias} dia(s)`,
            quantity: reserva.quantidadeChales * reserva.quantidadeDiarias,
            value: valorChalePorDia,
          });
        }
        break;

      case 'chale':
        itens.push({
          name: 'Chalés',
          description: `${reserva.quantidadeChales} chalé(s) por ${reserva.quantidadeDiarias} dia(s)`,
          quantity: reserva.quantidadeChales, // Já incluímos o cálculo na description
          value: dadosPagamento.valorDiaria,
        });
        break;

      case 'batismo':
        itens.push({
          name: 'Batismo',
          description: `Serviço de batismo para ${reserva.quantidadePessoas} pessoas`,
          quantity: 1,
          value: dadosPagamento.valorTotal,
        });
        break;
    }
    
    // 🔍 DEBUG: Log dos itens gerados
    console.log('🔍 DEBUG - Itens gerados para ASAAS:', itens);
    
    return itens;
  }

  /**
   * Constrói os dados do cliente para o ASAAS baseado nos dados da reserva
   */
  private buildCustomerData(reserva: Reserva): any {
    const customerData: any = {};

    this.logger.log(`DEBUG: Construindo customerData para reserva ${reserva.codigo}`);
    this.logger.log(`DEBUG: Dados do hóspede: ${JSON.stringify(reserva.dadosHospede)}`);
    this.logger.log(`DEBUG: Dados do hóspede endereco: ${reserva.dadosHospede?.endereco}`);
    this.logger.log(`DEBUG: Dados do hóspede uf: ${reserva.dadosHospede?.uf}`);

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
      this.logger.log(`DEBUG: Adicionando address: ${reserva.dadosHospede.endereco}`);
    } else {
      this.logger.log(`DEBUG: Endereço não encontrado nos dados do hóspede`);
    }

    if (reserva.dadosHospede?.numero) {
      customerData.addressNumber = reserva.dadosHospede.numero;
      this.logger.log(`DEBUG: Adicionando addressNumber: ${reserva.dadosHospede.numero}`);
    }

    if (reserva.dadosHospede?.cep) {
      customerData.postalCode = reserva.dadosHospede.cep.replace(/\D/g, '');
      this.logger.log(`DEBUG: Adicionando postalCode: ${reserva.dadosHospede.cep}`);
    }

    // Bairro (province no ASAAS)
    if (reserva.dadosHospede?.bairro) {
      customerData.province = reserva.dadosHospede.bairro;
      this.logger.log(`DEBUG: Adicionando province (bairro): ${reserva.dadosHospede.bairro}`);
    }

    // Cidade
    if (reserva.dadosHospede?.cidade) {
      customerData.city = reserva.dadosHospede.cidade;
      this.logger.log(`DEBUG: Adicionando city: ${reserva.dadosHospede.cidade}`);
    }

    // Estado/UF (state no ASAAS)
    if (reserva.dadosHospede?.uf) {
      customerData.state = reserva.dadosHospede.uf;
      this.logger.log(`DEBUG: Adicionando state (UF): ${reserva.dadosHospede.uf}`);
    } else {
      this.logger.log(`DEBUG: UF não encontrado nos dados do hóspede`);
    }

    this.logger.log(`DEBUG: CustomerData construído: ${JSON.stringify(customerData)}`);

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
}
