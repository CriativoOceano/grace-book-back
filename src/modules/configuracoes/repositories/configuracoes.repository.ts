import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UpdateConfiguracaoDto } from '../DTO/update-configuracoes.dto';
import { InjectModel } from '@nestjs/mongoose';
import { ConfiguracoesService } from '../configuracoes.service';
import { IConfiguracoesRepository } from './interfaces/reserva-repository.interface';

@Injectable()
export class ConfiguracoesRepository implements IConfiguracoesRepository {
  private readonly logger = new Logger(ConfiguracoesService.name);

  constructor(
    @InjectModel(UpdateConfiguracaoDto.name) private configuracaoModel,
  ) {
    // Inicializar as configurações padrão se não existirem
    this.inicializarConfiguracoes();
  }

  private async inicializarConfiguracoes(): Promise<void> {
    const count = await this.configuracaoModel.countDocuments().exec();

    if (count === 0) {
      this.logger.log('Inicializando configurações padrão do sistema');

      const configPadrao = {
        precoDiaria: [
          { maxPessoas: 30, valor: 1000 },
          { maxPessoas: 60, valor: 1500 },
          { maxPessoas: 100, valor: 2000 },
          { maxPessoas: 200, valor: 2500 },
        ],
        precoChale: 150,
        precoBatismo: 300,
        qtdMaxPessoas: 200,
        quantidadeMaximaChales: 4,
        diasAntecedenciaMinima: 5,
        emailRemetente: 'anderson.asp.si@gmail.com',
        manutencao: false,
      };

      await this.configuracaoModel.create(configPadrao);
      this.logger.log('Configurações padrão criadas com sucesso');
    }
  }

  async findAll(): Promise<UpdateConfiguracaoDto> {
    const configuracoes = await this.configuracaoModel.findOne().exec();
    if (!configuracoes) {
      await this.inicializarConfiguracoes();
      return this.configuracaoModel.findOne().exec();
    }
    return configuracoes;
  }

  async updateConfiguracoes(): Promise<UpdateConfiguracaoDto> {
    return;
    // const configuracoes = await this.configuracaoModel.findOne().exec();

    // if (!configuracoes) {
    //   throw new NotFoundException('Configurações não encontradas');
    // }

    // // Atualizar apenas os campos fornecidos
    // Object.assign(configuracoes, updateConfiguracaoDto);
    // configuracoes.dataAtualizacao = new Date();

    // await configuracoes.save();
    // this.logger.log('Configurações atualizadas com sucesso');

    // return configuracoes;
  }
}
