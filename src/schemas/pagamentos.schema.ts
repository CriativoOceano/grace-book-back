import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { Reserva } from './reserva.schema';
import { ModoPagamento, StatusPagamento } from 'src/modules/pagamentos/pagamento.enums';

export type PagamentoDocument = Pagamento & Document;
@Schema({ timestamps: true })
export class Pagamento {
  
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Reserva', required: true })
  reservaId: Reserva;

  @Prop({ required: true, enum: StatusPagamento})
  status: StatusPagamento;

  @Prop({ required: true, enum: ModoPagamento})
  modoPagamento: ModoPagamento;

  @Prop({ type: String })
  asaasPagamentoId: string;

  @Prop({type: Number, min: 1 })
  valorTotal: number;

  @Prop({type: Number})
  qtdParcelas: number;

  @Prop({ type: Date })
  dataPagamento: Date;

  @Prop()
  comprovante: string;

  @Prop()
  linkPagamento: string;
}

export const PagamentoSchema = SchemaFactory.createForClass(Pagamento);

PagamentoSchema.index({ reservaId: 1 });
PagamentoSchema.index({ status: 1 });
PagamentoSchema.index({ createdAt: -1 });