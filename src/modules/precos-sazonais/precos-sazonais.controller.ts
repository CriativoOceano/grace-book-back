import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PrecosSazonaisService } from './precos-sazonais.service';
import { CriarPrecoSazonalDto } from './dto/criar-preco-sazonal.dto';
import { AtualizarPrecoSazonalDto } from './dto/atualizar-preco-sazonal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('precos-sazonais')
export class PrecosSazonaisController {
  constructor(private readonly precosSazonaisService: PrecosSazonaisService) {}

  @Get()
  listar() {
    return this.precosSazonaisService.listar();
  }

  @Post()
  criar(@Body() dto: CriarPrecoSazonalDto, @Request() req) {
    return this.precosSazonaisService.criar(dto, req.user.nome);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarPrecoSazonalDto) {
    return this.precosSazonaisService.atualizar(id, dto);
  }

  @Delete(':id')
  remover(@Param('id') id: string) {
    return this.precosSazonaisService.remover(id);
  }
}
