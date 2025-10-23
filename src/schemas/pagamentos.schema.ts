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

  @Prop({ type: String, required: true})
  asaasPagamentoId: string;

  @Prop({ type: String })
  asaasCheckoutSessionId: string;

  @Prop({ type: String })
  asaasPaymentId: string;

  @Prop({type: Number, min: 1 })
  valorTotal: number;

  @Prop({type: Number})
  valor: number;

  @Prop({type: Number})
  qtdParcelas: number;

  @Prop({type: Number})
  parcelas: number;

  @Prop({ type: String })
  asaasInstallmentId: string;

  @Prop({ type: Date})
  dataPagamento: Date;

  @Prop()
  comprovante: string;

  @Prop({ type: Object })
  detalhes: any;

  @Prop({ type: Object })
  estorno: any;

  @Prop({required: true})
  linkPagamento: string;
}

export const PagamentoSchema = SchemaFactory.createForClass(Pagamento);

PagamentoSchema.index({ reservaId: 1 });
PagamentoSchema.index({ status: 1 });
PagamentoSchema.index({ createdAt: -1 });
PagamentoSchema.index({ externalId: 1 }, { unique: true, sparse: true });
PagamentoSchema.index({ 'detalhes.id': 1 }, { sparse: true });