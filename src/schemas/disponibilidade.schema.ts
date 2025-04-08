import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import { TipoReserva } from './reserva.schema';

export type DisponibilidadeDocument = Disponibilidade & Document;

// Interface para definir métodos estáticos
export interface DisponibilidadeModel extends Model<DisponibilidadeDocument> {
  verificarDisponibilidade(
    data: Date, 
    tipo: string,
    quantidadeChales?: number
  ): Promise<boolean>;
  
  atualizarAposReserva(
    data: Date,
    tipo: string,
    quantidadeChales?: number,
    adicionar?: boolean
  ): Promise<void>;
}

@Schema()
export class Disponibilidade {
  @Prop({ required: true, type: Date, unique: true })
  data: Date;

  @Prop({ required: true, default: true })
  disponibilidadeDiaria: boolean;

  @Prop({ required: true, type: Number, min: 0, default: 4 })
  chalesDisponiveis: number;

  @Prop({ required: true, default: true })
  disponibilidadeBatismo: boolean;

  @Prop()
  observacoes: string;
}

export const DisponibilidadeSchema = SchemaFactory.createForClass(Disponibilidade);

// Índice para melhorar performance de consulta por data
DisponibilidadeSchema.index({ data: 1 }, { unique: true });

// Método estático para verificar disponibilidade em uma data
DisponibilidadeSchema.statics.verificarDisponibilidade = async function(
  data: Date, 
  tipo: string,
  quantidadeChales: number = 0
): Promise<boolean> {
  // Normalizar data para considerar apenas o dia (sem horas)
  const dataConsulta = new Date(data);
  dataConsulta.setHours(0, 0, 0, 0);
  
  // Buscar registro de disponibilidade para a data
  const disponibilidade = await this.findOne({
    data: {
      $gte: dataConsulta,
      $lt: new Date(dataConsulta.getTime() + 24 * 60 * 60 * 1000)
    }
  });
  
  // Se não houver registro, assume-se que está disponível
  if (!disponibilidade) {
    // Verifica apenas se a quantidade de chalés solicitada é válida
    return tipo !== TipoReserva.CHALE || quantidadeChales <= 4;
  }
  
  // Verificar disponibilidade com base no tipo de reserva
  switch (tipo) {
    case TipoReserva.DIARIA:
      return disponibilidade.disponibilidadeDiaria;
    
    case TipoReserva.CHALE:
      return disponibilidade.chalesDisponiveis >= quantidadeChales;
    
    case TipoReserva.BATISMO:
      return disponibilidade.disponibilidadeBatismo;
    
    case TipoReserva.COMPLETO:
      return disponibilidade.disponibilidadeDiaria && 
             disponibilidade.chalesDisponiveis >= quantidadeChales;
    
    default:
      return false;
  }
};

// Método para atualizar disponibilidade após uma reserva
DisponibilidadeSchema.statics.atualizarAposReserva = async function(
  data: Date,
  tipo: string,
  quantidadeChales: number = 0,
  adicionar: boolean = false
): Promise<void> {
  // Normalizar data para considerar apenas o dia
  const dataConsulta = new Date(data);
  dataConsulta.setHours(0, 0, 0, 0);
  
  // Buscar ou criar registro de disponibilidade
  let disponibilidade = await this.findOne({
    data: {
      $gte: dataConsulta,
      $lt: new Date(dataConsulta.getTime() + 24 * 60 * 60 * 1000)
    }
  });
  
  if (!disponibilidade) {
    disponibilidade = await this.create({
      data: dataConsulta,
      disponibilidadeDiaria: true,
      chalesDisponiveis: 4,
      disponibilidadeBatismo: true
    });
  }
  
  // Atualizar disponibilidade com base no tipo de reserva
  const update: any = {};
  
  if (tipo === TipoReserva.DIARIA || tipo === TipoReserva.COMPLETO) {
    // Se estiver adicionando uma reserva, marca como indisponível
    // Se estiver removendo (cancelando) uma reserva, marca como disponível
    update.disponibilidadeDiaria = adicionar;
    update.disponibilidadeBatismo = adicionar;
  }
  
  if ((tipo === TipoReserva.CHALE || tipo === TipoReserva.COMPLETO) && quantidadeChales > 0) {
    // Adicionar ou remover chalés da disponibilidade
    if (adicionar) {
      // Adicionar chalés (cancelamento de reserva)
      update.chalesDisponiveis = Math.min(4, disponibilidade.chalesDisponiveis + quantidadeChales);
    } else {
      // Remover chalés (nova reserva)
      update.chalesDisponiveis = Math.max(0, disponibilidade.chalesDisponiveis - quantidadeChales);
    }
  }
  
  if (tipo === TipoReserva.BATISMO) {
    // Se estiver adicionando uma reserva, marca como indisponível
    // Se estiver removendo (cancelando) uma reserva, marca como disponível
    update.disponibilidadeBatismo = adicionar;
  }
  
  // Atualizar o registro de disponibilidade
  await this.updateOne({ _id: disponibilidade._id }, { $set: update });
};