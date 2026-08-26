import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { PagamentosService } from '../pagamentos.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ModoPagamento } from '../pagamento.enums';
import { IDadosPagamento } from '../interfaces/dados-pagamento.interface';
import { ReservaRepository } from 'src/modules/reservas/repositories/reserva.repository';

@Controller('pagamentos')
export class PagamentosController {
  constructor(
    private readonly pagamentosService: PagamentosService,
    private readonly reservaRepository: ReservaRepository,
  ) {}

  // Sem isso, qualquer usuário autenticado (não só admin) conseguia
  // consultar/gerar/cancelar cobrança de QUALQUER reserva só sabendo o
  // reservaId — nada aqui validava que a reserva pertence a quem chamou.
  private async verificarDono(reservaId: string, req: any): Promise<void> {
    const reserva = await this.reservaRepository.findById(reservaId);
    const donoId = reserva?.usuario?.['_id']?.toString?.() ?? reserva?.usuario?.toString?.();
    if (!req.user.isAdmin && donoId !== req.user.id) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar o pagamento desta reserva',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':reservaId/status')
  async consultarStatusPagamento(
    @Param('reservaId') reservaId: string,
    @Request() req,
  ) {
    await this.verificarDono(reservaId, req);
    return this.pagamentosService.consultarStatusCobranca(reservaId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':reservaId/gerar')
  async gerarPagamento(
    @Param('reservaId') reservaId: string,
    @Body('modoCobranca') dadosPagamento: IDadosPagamento,
    @Request() req,
  ) {
    await this.verificarDono(reservaId, req);
    return this.pagamentosService.criarCobranca(reservaId, dadosPagamento);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':reservaId/cancelar')
  async cancelarPagamento(
    @Param('reservaId') reservaId: string,
    @Request() req,
  ) {
    await this.verificarDono(reservaId, req);
    // Endpoint acessível ao próprio dono da reserva (JwtAuthGuard, sem
    // AdminGuard) — por isso devolvemos só um booleano. O detalhe técnico
    // do Asaas (endpoint, status, corpo da resposta) em `avisos` é
    // diagnóstico pra admin, não pode vazar pro cliente final aqui.
    const resultado =
      await this.pagamentosService.cancelarCheckoutPendente(reservaId);
    return { success: resultado.sucesso };
  }
}
