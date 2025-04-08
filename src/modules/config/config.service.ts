import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateConfiguracaoDto } from './DTO/update-config.dto';

@Injectable()
export class ConfiguracoesService {
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
          { maxPessoas: 200, valor: 2500 }
        ],
        precoChale: 150,
        precoBatismo: 300,
        quantidadeMaximaChales: 4,
        diasAntecedenciaMinima: 5,
        emailRemetente: 'anderson.asp.si@gmail.com',
        manutencao: false
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

  async update(updateConfiguracaoDto: UpdateConfiguracaoDto): Promise<UpdateConfiguracaoDto> {
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

  async obterValorReserva(tipo: string, quantidadePessoas?: number, quantidadeChales?: number): Promise<number> {
    const config = await this.findAll();
    let valorTotal = 0;
    
    switch (tipo) {
      case 'diaria':
        // Encontrar a faixa de preço correspondente
        for (const faixa of config.precoDiaria) {
          if (quantidadePessoas <= faixa.maxPessoas) {
            valorTotal = faixa.valor;
            break;
          }
        }
        break;
        
      case 'chale':
        valorTotal = (quantidadeChales || 0) * config.precoChale;
        break;
        
      case 'batismo':
        valorTotal = config.precoBatismo;
        break;
        
      case 'completo':
        // Calcular valor da diária
        for (const faixa of config.precoDiaria) {
          if (quantidadePessoas <= faixa.maxPessoas) {
            valorTotal += faixa.valor;
            break;
          }
        }
        
        // Adicionar valor dos chalés
        valorTotal += (quantidadeChales || 0) * config.precoChale;
        break;
        
      default:
        throw new Error(`Tipo de reserva '${tipo}' não reconhecido`);
    }
    
    return valorTotal;
  }
}