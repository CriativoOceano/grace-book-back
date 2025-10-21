import { 
  Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus,
  Logger 
} from '@nestjs/common';
import { PagamentosService } from '../pagamentos.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly pagamentosService: PagamentosService,
  ) {}

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async receberWebhookAsaas(@Body() payload: any) {
    const timestamp = new Date().toISOString();
    this.logger.log(`🔔 [${timestamp}] WEBHOOK ASAAS RECEBIDO`);
    this.logger.log(`📦 Payload completo: ${JSON.stringify(payload, null, 2)}`);
    
    try {
      await this.pagamentosService.processarWebhook(payload);
      this.logger.log(`✅ [${timestamp}] Webhook processado com sucesso`);
      return { received: true, status: 'success', timestamp };
    } catch (error) {
      this.logger.error(`❌ [${timestamp}] Erro ao processar webhook: ${error.message}`);
      this.logger.error(`📦 Payload que causou erro: ${JSON.stringify(payload, null, 2)}`);
      
      // Retornar 200 mesmo em caso de erro para evitar retry do ASAAS
      return { received: true, status: 'error', error: error.message, timestamp };
    }
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testarWebhook(@Body() payload: any) {
    this.logger.log(`🧪 TESTE DE WEBHOOK - Payload: ${JSON.stringify(payload, null, 2)}`);
    
    try {
      await this.pagamentosService.processarWebhook(payload);
      this.logger.log(`✅ Teste de webhook processado com sucesso`);
      return { received: true, status: 'success', message: 'Webhook de teste processado' };
    } catch (error) {
      this.logger.error(`❌ Erro no teste de webhook: ${error.message}`);
      return { received: true, status: 'error', error: error.message };
    }
  }

  @Post('migrar-dados')
  @HttpCode(HttpStatus.OK)
  async migrarDados() {
    this.logger.log(`🔄 Executando migração manual de dados...`);
    
    try {
      await this.pagamentosService.migrarDadosExistentes();
      this.logger.log(`✅ Migração manual concluída com sucesso`);
      return { 
        received: true, 
        status: 'success', 
        message: 'Migração de dados executada com sucesso' 
      };
    } catch (error) {
      this.logger.error(`❌ Erro na migração manual: ${error.message}`);
      return { 
        received: true, 
        status: 'error', 
        error: error.message 
      };
    }
  }

  @Post('verificar-expirados')
  @HttpCode(HttpStatus.OK)
  async verificarPagamentosExpirados() {
    this.logger.log(`⏰ Executando verificação manual de pagamentos expirados...`);
    
    try {
      await this.pagamentosService.verificarECancelarPagamentosExpirados();
      this.logger.log(`✅ Verificação de pagamentos expirados concluída com sucesso`);
      return { 
        received: true, 
        status: 'success', 
        message: 'Verificação de pagamentos expirados executada com sucesso' 
      };
    } catch (error) {
      this.logger.error(`❌ Erro na verificação de pagamentos expirados: ${error.message}`);
      return { 
        received: true, 
        status: 'error', 
        error: error.message 
      };
    }
  }
}
