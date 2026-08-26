import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Inject,
  Request,
} from '@nestjs/common';
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
    @Inject(CONFIGURACOES_REPOSITORY)
    private readonly configuracoesRepository: ConfiguracoesRepository,
  ) {}

  // Rota pública: o front usa isso para montar a tela de reserva (preços,
  // capacidade etc.) sem login. Por isso não leva guard — mas por conta
  // disso NUNCA pode devolver adminAccessCode (hash do código de admin) ou
  // asaasApiKey, que também moram neste documento.
  @Get()
  async findAll() {
    const configuracoes: any = await this.configuracoesRepository.findAll();
    const plano =
      typeof configuracoes.toObject === 'function'
        ? configuracoes.toObject()
        : configuracoes;
    const { adminAccessCode, asaasApiKey, ...configuracoesPublicas } = plano;
    return configuracoesPublicas;
  }

  @Get('conteudo-site')
  getConteudoSite() {
    return this.configuracoesRepository.getConteudoSite();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @Body() updateConfiguracaoDto: UpdateConfiguracaoDto,
    @Request() req,
  ) {
    return this.configuracoesRepository.updateConfiguracoes(
      updateConfiguracaoDto,
      req.user.nome,
    );
  }

  @Patch('conteudo-site')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateConteudoSite(
    @Body() updateConteudoSiteDto: UpdateConteudoSiteDto,
    @Request() req,
  ) {
    return this.configuracoesRepository.updateConteudoSite(
      updateConteudoSiteDto.conteudoSite,
      req.user.nome,
    );
  }
}
