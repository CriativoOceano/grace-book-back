import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';

export type ConfiguracaoDocument = Configuracao & Document;

// Interface para definir métodos estáticos
export interface ConfiguracaoModel extends Model<ConfiguracaoDocument> {
  getConfig(): Promise<ConfiguracaoDocument>;
}

// Interface para faixa de preços por quantidade de pessoas
export class FaixaPreco {
  @Prop({ required: true })
  maxPessoas: number;

  @Prop({ required: true, type: Number, min: 0 })
  valor: number;
}

@Schema({ timestamps: true })
export class Configuracao {
  @Prop({ type: [Object], required: true })
  precoDiaria: FaixaPreco[];

  @Prop({ required: true, type: Number, min: 0 })
  precoChale: number;

  @Prop({ required: true, type: Number, min: 0 })
  precoBatismo: number;

  @Prop({ required: true, type: Number, min: 1, default: 4 })
  quantidadeMaximaChales: number;

  @Prop({ required: true, type: Number, min: 0, default: 2 })
  diasAntecedenciaMinima: number;

  @Prop({ required: true })
  emailRemetente: string;

  @Prop({ default: false })
  manutencao: boolean;

  @Prop({ type: String })
  asaasApiKey: string;

  @Prop({ type: String, default: 'https://sandbox.asaas.com/api/v3' })
  asaasUrl: string;

  @Prop({ type: Date, default: Date.now })
  dataAtualizacao: Date;
}

export const ConfiguracaoSchema = SchemaFactory.createForClass(Configuracao);

// Garantir que sempre exista uma configuração padrão no sistema
ConfiguracaoSchema.statics.getConfig = async function() {
  // Buscar configuração existente ou criar uma padrão
  const config = await this.findOne();
  
  if (config) {
    return config;
  }
  
  // Configuração padrão
  const defaultConfig = {
    precoDiaria: [
      { maxPessoas: 30, valor: 1000 },
      { maxPessoas: 60, valor: 1500 },
      { maxPessoas: 100, valor: 2000 },
      { maxPessoas: 200, valor: 2500 }
    ],
    precoChale: 150,
    precoBatismo: 300,
    quantidadeMaximaChales: 4,
    diasAntecedenciaMinima: 2,
    emailRemetente: 'reservas@fontedagraca.com.br',
    manutencao: false,
    asaasApiKey: '',
    asaasUrl: 'https://sandbox.asaas.com/api/v3'
  };
  
  return this.create(defaultConfig);
};