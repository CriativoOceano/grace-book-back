import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ParcelaDocument = Parcela & Document;

export enum StatusParcela {
  PENDENTE = 'PENDENTE',
  PAGO = 'PAGO',
  CANCELADO = 'CANCELADO',
  ATRASADO = 'ATRASADO',
  ERRO = 'ERRO',
}

@Schema({ timestamps: true })
export class Parcela {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Pagamento' })
  pagamentoId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  numeroParcela: number;

  @Prop({ required: true, type: Number })
  valor: number;

  @Prop({ required: true })
  dataVencimento: Date;

  @Prop({ type: Date })
  dataPagamento: Date;

  @Prop({ 
    required: true, 
    enum: StatusParcela, 
    default: StatusParcela.PENDENTE 
  })
  status: StatusParcela;

  @Prop()
  idParcela: string; // ID da parcela no ASAAS ou outro gateway

  @Prop()
  linkBoleto: string;

  @Prop()
  linkPix: string;

  @Prop()
  codigoBarra: string;

  @Prop()
  codigoPix: string;

  @Prop()
  mensagemErro: string;

  @Prop({ type: Object })
  metadados: Record<string, any>; // Informações adicionais ou respostas completas do gateway
}

export const ParcelaSchema = SchemaFactory.createForClass(Parcela);

// Índices para melhorar performance de consultas comuns
ParcelaSchema.index({ pagamentoId: 1 });
ParcelaSchema.index({ status: 1 });
ParcelaSchema.index({ dataVencimento: 1 });
ParcelaSchema.index({ idExterno: 1 }, { unique: true, sparse: true });