import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PrecoSazonalDocument = PrecoSazonal & Document;

export type TipoAjustePreco = 'percentual' | 'fixo';

// Regra de preço por período (feriados, fim de ano, datas comemorativas...).
// O ajuste é aplicado por dia sobre o preço base (diária/chalé/batismo) de
// cada data dentro do intervalo [dataInicio, dataFim].
@Schema({ timestamps: true })
export class PrecoSazonal {
  @Prop({ required: true })
  nome: string;

  @Prop({ required: true, type: Date })
  dataInicio: Date;

  @Prop({ required: true, type: Date })
  dataFim: Date;

  @Prop({ required: true, enum: ['percentual', 'fixo'] })
  tipoAjuste: TipoAjustePreco;

  @Prop({ required: true, type: Number })
  valorAjuste: number;

  @Prop({ default: true })
  ativo: boolean;

  @Prop({ type: String })
  criadoPorNome?: string;
}

export const PrecoSazonalSchema = SchemaFactory.createForClass(PrecoSazonal);

PrecoSazonalSchema.index({ ativo: 1, dataInicio: 1, dataFim: 1 });
