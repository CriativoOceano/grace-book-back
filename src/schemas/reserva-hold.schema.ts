import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ReservaHoldDocument = ReservaHold & Document;

/**
 * Trava atômica por diária para impedir reserva dupla.
 * Cada noite de uma reserva gera um documento aqui; o índice único
 * {data, recurso} faz o MongoDB rejeitar (E11000) uma segunda reserva
 * concorrente para a mesma noite/recurso, mesmo sob condição de corrida.
 */
@Schema({ timestamps: true })
export class ReservaHold {
  @Prop({ required: true, type: Date })
  data: Date;

  // 'principal' = exclusividade diária/batismo na propriedade inteira.
  // 'chale-N' = uma unidade de chalé (N de 1 a 4) numa noite específica.
  @Prop({ required: true })
  recurso: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Reserva', required: true })
  reservaId: MongooseSchema.Types.ObjectId;
}

export const ReservaHoldSchema = SchemaFactory.createForClass(ReservaHold);

ReservaHoldSchema.index({ data: 1, recurso: 1 }, { unique: true });
ReservaHoldSchema.index({ reservaId: 1 });
