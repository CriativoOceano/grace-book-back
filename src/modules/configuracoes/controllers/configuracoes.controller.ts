import { Controller, Get, Patch, Body, UseGuards, Inject } from '@nestjs/common';
import { ConfiguracoesService } from '../configuracoes.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/modules/auth/guards/admin.guard';
import { UpdateConfiguracaoDto } from '../DTO/update-configuracoes.dto';
import { UpdateConteudoSiteDto } from '../DTO/update-conteudo-site.dto';
import { ConfiguracoesRepository } from '../repositories/configuracoes.repository';
import { CONFIGURACOES_REPOSITORY } from '../repositories/configuracaoes-repository.provider';

@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(
    @Inject(CONFIGURACOES_REPOSITORY) private readonly configuracoesRepository: ConfiguracoesRepository
  ) {}

  @Get()
  findAll() {
    return this.configuracoesRepository.findAll();
  }

  @Get('conteudo-site')
  getConteudoSite() {
    return this.configuracoesRepository.getConteudoSite();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Body() updateConfiguracaoDto: UpdateConfiguracaoDto) {
    return this.configuracoesRepository.updateConfiguracoes(updateConfiguracaoDto);
  }

  @Patch('conteudo-site')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateConteudoSite(@Body() updateConteudoSiteDto: UpdateConteudoSiteDto) {
    return this.configuracoesRepository.updateConteudoSite(updateConteudoSiteDto.conteudoSite);
  }
}