import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { DisponibilidadeService } from './disponibilidade.service';
import { BloquearDataDto } from './dto/bloquear-data.dto';
import { UpdateDisponibilidadeDto } from './dto/update-disponibilidade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('disponibilidade')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DisponibilidadeController {
  constructor(private readonly disponibilidadeService: DisponibilidadeService) {}

  @Get()
  async listarBloqueios() {
    return this.disponibilidadeService.listarBloqueios();
  }

  @Post('bloquear')
  async bloquearPeriodo(@Body() bloquearDataDto: BloquearDataDto) {
    return this.disponibilidadeService.bloquearPeriodo(bloquearDataDto);
  }

  @Delete(':id')
  async desbloquearData(@Param('id') id: string) {
    await this.disponibilidadeService.desbloquearData(id);
    return { message: 'Data desbloqueada com sucesso' };
  }

  @Patch(':id')
  async atualizarBloqueio(
    @Param('id') id: string,
    @Body() updateDisponibilidadeDto: UpdateDisponibilidadeDto
  ) {
    return this.disponibilidadeService.atualizarBloqueio(id, updateDisponibilidadeDto);
  }
}
