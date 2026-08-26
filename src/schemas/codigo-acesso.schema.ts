import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CodigoAcessoDocument = CodigoAcesso & Document;

// Cada código de acesso admin pertence a uma pessoa nomeada, não é mais um
// segredo único compartilhado. O código em si nunca é guardado em texto
// puro — só o hash (igual senha) — porque só é mostrado uma vez, no
// momento em que é gerado. Login com o código popula o JWT com o nome do
// dono, o que dá rastreabilidade em ações administrativas (ver `nome` em
// req.user nos controllers que usam AdminGuard).
@Schema({ timestamps: true })
export class CodigoAcesso {
  @Prop({ required: true, trim: true })
  nome: string;

  @Prop({ required: true })
  codigoHash: string;

  @Prop({ default: true })
  ativo: boolean;

  @Prop({ type: Date })
  ultimoUso?: Date;

  @Prop()
  criadoPorNome?: string;

  @Prop({ type: Date })
  revogadoEm?: Date;

  @Prop()
  revogadoPorNome?: string;
}

export const CodigoAcessoSchema = SchemaFactory.createForClass(CodigoAcesso);
