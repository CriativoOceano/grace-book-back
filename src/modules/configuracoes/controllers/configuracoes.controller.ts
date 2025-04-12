import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ConfiguracoesService } from '../configuracoes.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/modules/auth/guards/admin.guard';
import { UpdateConfiguracaoDto } from '../DTO/update-configuracoes.dto';
import { ConfiguracoesRepository } from '../repositories/configuracoes.repository';

@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(private readonly configuracoesRepository: ConfiguracoesRepository) {}

  @Get()
  findAll() {
    return this.configuracoesRepository.findAll();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Body() updateConfiguracaoDto: UpdateConfiguracaoDto) {
    return this.configuracoesRepository.updateConfiguracoes();
  }
}