import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Schema as MongooseSchema } from 'mongoose';
import { Usuario } from './usuario.schema';
import { Pagamento } from './pagamentos.schema';
import { StatusReserva, TipoReserva } from 'src/modules/reservas/reserva.enums';
import { DadosHospede } from '../interfaces/dados-hospede.interface';

export type ReservaDocument = Reserva & Document;

export interface ReservaModel extends Model<ReservaDocument> {
  gerarCodigoReserva(): Promise<string>;
  gerarCodigoAcesso(): string;
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

  // Adicionar campos explícitos para email e nome do usuário (redundância controlada)
  @Prop({ required: true })
  usuarioEmail: string;

  @Prop({ required: true })
  usuarioNome: string;

  @Prop({ required: true, enum: TipoReserva })
  tipo: TipoReserva;

  @Prop({
    required: true,
    enum: StatusReserva,
    default: StatusReserva.PENDENTE,
  })
  statusReserva: StatusReserva;

  @Prop({ required: true, type: Date })
  dataInicio: Date;

  @Prop({ required: true, type: Date })
  dataFim: Date;

  @Prop({ type: Number, min: 0 })
  quantidadePessoas: number;

  @Prop({ type: Number, min: 0 })
  quantidadeChales: number;

  @Prop({ type: Number, min: 0 })
  quantidadeDiarias: number;

  @Prop({ required: true, type: Number, min: 1 })
  valorTotal: number;

  @Prop({ type: Number })
  valorDiaria: number;

  @Prop({ type: Number })
  valorDiariaComChale: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pagamento' })
  pagamento: Pagamento;

  @Prop({ type: Object })
  dadosPagamento: any;

  @Prop({ type: Object })
  dadosHospede?: DadosHospede;

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
ReservaSchema.index({ usuarioEmail: 1 }); // Índice não-único para o email
ReservaSchema.index({ dataInicio: 1, dataFim: 1 });
ReservaSchema.index({ 'pagamento.status': 1 });

// Middleware para garantir que os campos de usuário sejam preenchidos
ReservaSchema.pre('save', async function(next) {
  const reserva = this as ReservaDocument;
  if (!reserva.usuario) {
    return next(new Error('Usuário é obrigatório para criar uma reserva'));
  }
  
  try {
    // Se o usuário for apenas um ID, buscar os dados completos
    if (typeof reserva.usuario === 'string' || reserva.usuario instanceof MongooseSchema.Types.ObjectId) {
      const Usuario = this.model('Usuario');
      const usuarioCompleto: Usuario = await Usuario.findById(reserva.usuario);
      
      if (!usuarioCompleto) {
        return next(new Error('Usuário não encontrado'));
      }
      
      reserva.usuarioEmail = usuarioCompleto.email;
      reserva.usuarioNome = usuarioCompleto.nome;
    } else if (typeof reserva.usuario === 'object') {
      // Se já temos o objeto usuário, extrair os dados
      if (!reserva.usuario.email || !reserva.usuario.nome) {
        return next(new Error('Dados do usuário incompletos'));
      }
      
      reserva.usuarioEmail = reserva.usuario.email;
      reserva.usuarioNome = reserva.usuario.nome;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Método para gerar código único de reserva
ReservaSchema.statics.gerarCodigoReserva = async function (): Promise<string> {
  // Prefixo para o código de reserva
  const prefixo = 'RES';

  // Buscar última reserva para obter o último número
  const ultimaReserva = await this.findOne(
    {},
    {},
    { sort: { dataCriacao: -1 } },
  );

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
ReservaSchema.statics.gerarCodigoAcesso = function (): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Middleware para adicionar entrada no histórico em caso de alteração
ReservaSchema.pre('findOneAndUpdate', function (next) {
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
      detalhes: 'Detalhes da reserva foram atualizados',
    };
  }

  next();
});