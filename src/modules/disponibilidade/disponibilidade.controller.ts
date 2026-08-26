import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DisponibilidadeService } from './disponibilidade.service';
import { BloquearDataDto } from './dto/bloquear-data.dto';
import { UpdateDisponibilidadeDto } from './dto/update-disponibilidade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('disponibilidade')
export class DisponibilidadeController {
  constructor(
    private readonly disponibilidadeService: DisponibilidadeService,
  ) {}

  // Pública de propósito: o calendário de reservas do site (sem login)
  // usa isso pra desabilitar visualmente os dias que o admin bloqueou —
  // sem essa rota, o bloqueio só era aplicado na hora de submeter a
  // reserva, sem nenhum feedback visual antes disso.
  @Get('publico')
  async listarBloqueiosPublico() {
    return this.disponibilidadeService.listarBloqueiosPublico();
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listarBloqueios() {
    return this.disponibilidadeService.listarBloqueios();
  }

  @Post('bloquear')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async bloquearPeriodo(@Body() bloquearDataDto: BloquearDataDto) {
    return this.disponibilidadeService.bloquearPeriodo(bloquearDataDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async desbloquearData(@Param('id') id: string) {
    await this.disponibilidadeService.desbloquearData(id);
    return { message: 'Data desbloqueada com sucesso' };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async atualizarBloqueio(
    @Param('id') id: string,
    @Body() updateDisponibilidadeDto: UpdateDisponibilidadeDto,
  ) {
    return this.disponibilidadeService.atualizarBloqueio(
      id,
      updateDisponibilidadeDto,
    );
  }
}
