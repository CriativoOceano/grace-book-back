import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UsuarioDocument = Usuario & Document;

// Interface para definir métodos estáticos
export interface UsuarioModel extends Model<UsuarioDocument> {
  gerarCodigoAcesso(email: string): Promise<string>;
}

@Schema({ timestamps: true })
export class Usuario {
  @Prop({ required: true })
  nome: string;

  @Prop()
  sobrenome: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, unique: true })
  cpf: string;

  @Prop()
  telefone: string;

  @Prop({ select: false })
  senha: string;

  @Prop({ default: Date.now })
  dataCadastro: Date;

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop()
  ultimoAcesso: Date;

  // Campo para armazenar código de acesso temporário
  @Prop()
  codigoAcesso: string;

  @Prop()
  expiracaoCodigo: Date;

  compararSenha?(senha: string): Promise<boolean>;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);

// Middleware de pré-salvamento para criptografar senha
UsuarioSchema.pre('save', async function (next) {
  const usuario = this as UsuarioDocument;

  // Só criptografa se a senha foi modificada
  if (!usuario.isModified('senha')) {
    return next();
  }

  try {
    // Gerar um salt e criptografar a senha
    const salt = await bcrypt.genSalt(10);
    usuario.senha = await bcrypt.hash(usuario.senha, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// Método estático para gerar código de acesso
UsuarioSchema.statics.gerarCodigoAcesso = async function (
  email: string,
): Promise<string> {
  // Gerar código aleatório
  const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

  // Validade do código: precisa bater com o texto do e-mail em
  // email.service.ts ("Válido por 2 minutos") — ver EmailsService.
  const expiracao = new Date();
  expiracao.setMinutes(expiracao.getMinutes() + 2);

  // Atualizar usuário com o novo código
  await this.findOneAndUpdate(
    { email },
    {
      codigoAcesso: codigo,
      expiracaoCodigo: expiracao,
    },
  );

  return codigo;
};

UsuarioSchema.methods.compararSenha = async function (
  senha: string,
): Promise<boolean> {
  if (!this.senha) {
    // Documento carregado sem o campo `senha` selecionado (select: false
    // por padrão) — quem chama precisa buscar o usuário com
    // `.select('+senha')` antes de comparar.
    return false;
  }
  try {
    return await bcrypt.compare(senha, this.senha);
  } catch (error) {
    return false;
  }
};
