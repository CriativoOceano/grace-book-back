import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PagamentosService } from '../pagamentos.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly pagamentosService: PagamentosService,
    private readonly configService: ConfigService,
  ) {}

  // O Asaas envia o token configurado no painel de webhooks no header
  // `asaas-access-token` em toda chamada. Sem checar isso, qualquer POST
  // externo conseguia confirmar pagamentos que nunca aconteceram.
  private validarOrigemAsaas(token: string | undefined): void {
    const segredo = this.configService.get<string>('ASAAS_WEBHOOK_SECRET');
    if (!segredo) {
      this.logger.error(
        'ASAAS_WEBHOOK_SECRET não configurado — recusando webhook por segurança.',
      );
      throw new UnauthorizedException('Webhook não configurado corretamente');
    }
    if (!token || token !== segredo) {
      throw new UnauthorizedException('Token de webhook inválido');
    }
  }

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async receberWebhookAsaas(
    @Body() payload: any,
    @Headers('asaas-access-token') token: string,
  ) {
    this.validarOrigemAsaas(token);

    const timestamp = new Date().toISOString();
    this.logger.log(`🔔 [${timestamp}] WEBHOOK ASAAS RECEBIDO`);
    this.logger.log(`📦 Payload completo: ${JSON.stringify(payload, null, 2)}`);

    try {
      await this.pagamentosService.processarWebhook(payload);
      this.logger.log(`✅ [${timestamp}] Webhook processado com sucesso`);
      return { received: true, status: 'success', timestamp };
    } catch (error) {
      this.logger.error(
        `❌ [${timestamp}] Erro ao processar webhook: ${error.message}`,
      );
      this.logger.error(
        `📦 Payload que causou erro: ${JSON.stringify(payload, null, 2)}`,
      );

      // Retornar 200 mesmo em caso de erro para evitar retry do ASAAS
      return {
        received: true,
        status: 'error',
        error: error.message,
        timestamp,
      };
    }
  }

  // Ferramentas operacionais/debug — nunca devem ficar públicas: permitem
  // forçar confirmação de pagamento, migração de dados e cancelamento em
  // massa de pagamentos expirados.
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testarWebhook(@Body() payload: any) {
    this.logger.log(
      `🧪 TESTE DE WEBHOOK - Payload: ${JSON.stringify(payload, null, 2)}`,
    );

    try {
      await this.pagamentosService.processarWebhook(payload);
      this.logger.log(`✅ Teste de webhook processado com sucesso`);
      return {
        received: true,
        status: 'success',
        message: 'Webhook de teste processado',
      };
    } catch (error) {
      this.logger.error(`❌ Erro no teste de webhook: ${error.message}`);
      return { received: true, status: 'error', error: error.message };
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
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
        message: 'Migração de dados executada com sucesso',
      };
    } catch (error) {
      this.logger.error(`❌ Erro na migração manual: ${error.message}`);
      return {
        received: true,
        status: 'error',
        error: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('verificar-expirados')
  @HttpCode(HttpStatus.OK)
  async verificarPagamentosExpirados() {
    this.logger.log(
      `⏰ Executando verificação manual de pagamentos expirados...`,
    );

    try {
      await this.pagamentosService.verificarECancelarPagamentosExpirados();
      this.logger.log(
        `✅ Verificação de pagamentos expirados concluída com sucesso`,
      );
      return {
        received: true,
        status: 'success',
        message: 'Verificação de pagamentos expirados executada com sucesso',
      };
    } catch (error) {
      this.logger.error(
        `❌ Erro na verificação de pagamentos expirados: ${error.message}`,
      );
      return {
        received: true,
        status: 'error',
        error: error.message,
      };
    }
  }
}
