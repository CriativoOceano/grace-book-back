import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UpdateConfiguracaoDto } from '../DTO/update-configuracoes.dto';
import { ConteudoSiteDto } from '../DTO/update-conteudo-site.dto';
import { InjectModel } from '@nestjs/mongoose';
import { IConfiguracoesRepository } from './interfaces/reserva-repository.interface';
import { Configuracao, ConfiguracaoModel } from '../../../schemas/config.schema';

export const CONFIGURACOES_REPOSITORY = 'IConfiguracoesRepository';

@Injectable()
export class ConfiguracoesRepository implements IConfiguracoesRepository {
  private readonly logger = new Logger(ConfiguracoesRepository.name);

  constructor(
    @InjectModel(Configuracao.name) private configuracaoModel: ConfiguracaoModel,
  ) {
    // Inicializar as configurações padrão se não existirem
    this.inicializarConfiguracoes();
  }

  private async inicializarConfiguracoes(): Promise<void> {
    const count = await this.configuracaoModel.countDocuments().exec();

    if (count === 0) {
      this.logger.log('Inicializando configurações padrão do sistema');
      
      // Usar o método estático do schema para criar configuração padrão
      await this.configuracaoModel.getConfig();
      this.logger.log('Configurações padrão criadas com sucesso');
    }
  }

  async findAll(): Promise<Configuracao> {
    const configuracoes = await this.configuracaoModel.getConfig();
    return configuracoes;
  }

  async getConteudoSite(): Promise<ConteudoSiteDto> {
    const configuracoes = await this.configuracaoModel.getConfig();
    return configuracoes.conteudoSite || {};
  }

  async updateConfiguracoes(updateConfiguracaoDto: UpdateConfiguracaoDto): Promise<Configuracao> {
    const configuracoes = await this.configuracaoModel.findOne().exec();

    if (!configuracoes) {
      throw new NotFoundException('Configurações não encontradas');
    }

    // Atualizar apenas os campos fornecidos
    Object.assign(configuracoes, updateConfiguracaoDto);
    configuracoes.dataAtualizacao = new Date();

    await configuracoes.save();
    this.logger.log('Configurações atualizadas com sucesso');

    return configuracoes;
  }

  async updateConteudoSite(conteudoSite: ConteudoSiteDto): Promise<ConteudoSiteDto> {
    const configuracoes = await this.configuracaoModel.getConfig();
    
    if (!configuracoes) {
      throw new NotFoundException('Configurações não encontradas');
    }

    // Atualizar o conteúdo do site
    configuracoes.conteudoSite = { ...configuracoes.conteudoSite, ...conteudoSite };
    configuracoes.dataAtualizacao = new Date();

    await configuracoes.save();
    this.logger.log('Conteúdo do site atualizado com sucesso');

    return configuracoes.conteudoSite;
  }
}

