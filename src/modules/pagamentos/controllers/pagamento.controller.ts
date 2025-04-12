import { 
    Controller, 
    Post, 
    Body, 
    Get, 
    Param, 
    UseGuards, 
    Request, 
    HttpCode, 
    HttpStatus 
  } from '@nestjs/common';
import { PagamentosService } from '../pagamentos.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ModoPagamento } from '../pagamento.enums';
import { IDadosPagamento } from '../interfaces/dados-pagamento.interface';
  
  @Controller('pagamentos')
  export class PagamentosController {
    constructor(
      private readonly pagamentosService: PagamentosService,
    ) {}
  
    @UseGuards(JwtAuthGuard)
    @Get(':reservaId/status')
    async consultarStatusPagamento(@Param('reservaId') reservaId: string) {
      return this.pagamentosService.consultarStatusCobranca(reservaId);
    }
  
    @UseGuards(JwtAuthGuard)
    @Post(':reservaId/gerar')
    async gerarPagamento(@Param('reservaId') reservaId: string, @Body('modoCobranca') dadosPagamento: IDadosPagamento) {
      return this.pagamentosService.criarCobranca(reservaId, dadosPagamento);
    }
  
    @UseGuards(JwtAuthGuard)
    @Post(':reservaId/cancelar')
    async cancelarPagamento(@Param('reservaId') reservaId: string) {
      const cancelado = await this.pagamentosService.cancelarCobranca(reservaId);
      return { success: cancelado };
    }
  
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async receberWebhook(@Body() payload: any) {
      await this.pagamentosService.processarWebhook(payload);
      return { received: true };
    }
  }