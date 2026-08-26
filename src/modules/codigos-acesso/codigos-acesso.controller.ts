import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CodigosAcessoService } from './codigos-acesso.service';
import { CriarCodigoAcessoDto } from './dto/criar-codigo-acesso.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('codigos-acesso')
export class CodigosAcessoController {
  constructor(private readonly codigosAcessoService: CodigosAcessoService) {}

  @Get()
  listar() {
    return this.codigosAcessoService.listar();
  }

  @Post()
  criar(@Body() dto: CriarCodigoAcessoDto, @Request() req) {
    return this.codigosAcessoService.criar(dto.nome, req.user.nome);
  }

  @Delete(':id')
  revogar(@Param('id') id: string, @Request() req) {
    return this.codigosAcessoService.revogar(id, req.user.nome);
  }
}
