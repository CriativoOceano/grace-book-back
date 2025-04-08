import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Model, Schema as MongooseSchema } from 'mongoose';
import { Usuario } from './usuario.schema';
import { Pagamento } from './pagamentos.schema';


export type ReservaDocument = Reserva & Document;

export interface ReservaModel extends Model<ReservaDocument> {
  gerarCodigoReserva(): Promise<string>;
  gerarCodigoAcesso(): string;
}

// Enum para tipos de reserva
export enum TipoReserva {
  DIARIA = 'diaria',
  CHALE = 'chale',
  BATISMO = 'batismo',
  COMPLETO = 'completo'
}

// Enum para status de pagamento
export enum StatusPagamento {
  PENDENTE = 'pendente',
  PAGO = 'pago',
  CANCELADO = 'cancelado',
  REEMBOLSADO = 'reembolsado'
}

// Classe para histórico de alterações na reserva
export class HistoricoReserva {
  @Prop({ required: true, type: Date, default: Date.now })
  data: Date;

  @Prop({ required: true })
  acao: string;

  @Prop()
  detalhes: string;
}

@Schema({ timestamps: true })
export class Reserva {
  @Prop({ required: true, unique: true })
  codigo: string;

  @Prop({ required: true })
  codigoAcesso: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Usuario', required: true })
  usuario: Usuario;

  @Prop({ required: true, enum: TipoReserva })
  tipo: TipoReserva;

  @Prop({ required: true, type: Date })
  dataInicio: Date;

  @Prop({ required: true, type: Date })
  dataFim: Date;

  @Prop({ type: Number, min: 0 })
  quantidadePessoas: number;

  @Prop({ type: Number, min: 0 })
  quantidadeChales: number;

  @Prop({ required: true, type: Number, min: 0 })
  valorTotal: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pagamento'})
  pagamento: Pagamento;

  @Prop()
  observacoes: string;

  @Prop({ type: [Object], default: [] })
  historico: HistoricoReserva[];

  @Prop({ type: Date, default: Date.now })
  dataCriacao: Date;

  @Prop({ type: Date, default: Date.now })
  dataAtualizacao: Date;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);

// Índices para melhorar performance de consultas
ReservaSchema.index({ codigo: 1 }, { unique: true });
ReservaSchema.index({ usuario: 1 });
ReservaSchema.index({ dataInicio: 1, dataFim: 1 });
ReservaSchema.index({ 'pagamento.status': 1 });

// Método para gerar código único de reserva
ReservaSchema.statics.gerarCodigoReserva = async function(): Promise<string> {
  // Prefixo para o código de reserva
  const prefixo = 'RES';
  
  // Buscar última reserva para obter o último número
  const ultimaReserva = await this.findOne({}, {}, { sort: { dataCriacao: -1 } });
  
  let proximoNumero = 1000; // Número inicial
  
  if (ultimaReserva && ultimaReserva.codigo) {
    // Extrair o número da última reserva
    const match = ultimaReserva.codigo.match(/\d+$/);
    if (match) {
      proximoNumero = parseInt(match[0], 10) + 1;
    }
  }
  
  // Formatar o código
  return `${prefixo}${proximoNumero}`;
};

// Método para gerar código de acesso aleatório
ReservaSchema.statics.gerarCodigoAcesso = function(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Middleware para adicionar entrada no histórico em caso de alteração
ReservaSchema.pre('findOneAndUpdate', function(next) {
  // @ts-ignore
  const update = this.getUpdate();
  
  if (!update) return next();
  
  // Adicionar entrada no histórico
  if (!update.push) {
    update.push = {};
  }
  
  if (!update.push.historico) {
    update.push.historico = {
      data: new Date(),
      acao: 'Reserva atualizada',
      detalhes: 'Detalhes da reserva foram atualizados'
    };
  }
  
  // Atualizar data de atualização
  // if (!update.) {
  //   update.$set = {};
  // }
  
  // update.$set.dataAtualizacao = new Date();
  
  next();
});