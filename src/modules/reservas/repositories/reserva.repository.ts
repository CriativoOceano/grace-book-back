import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IReservaRepository } from './interfaces/reserva-repository.interface';
import {
  HistoricoReserva,
  Reserva,
  ReservaDocument,
} from 'src/schemas/reserva.schema';
import { StatusReserva } from '../reserva.enums';

@Injectable()
export class ReservaRepository implements IReservaRepository {
  constructor(
    @InjectModel(Reserva.name) private reservaModel: Model<ReservaDocument>,
  ) {}

  async findAll(): Promise<Reserva[]> {
    const reservas = await this.reservaModel
      .find()
      .populate('usuario')
      .sort({ createdAt: -1 })
      .exec();

    // Converter _id para id para compatibilidade com frontend
    return reservas.map((reserva) => ({
      ...reserva.toObject(),
      id: reserva._id.toString(),
    }));
  }

  async findByUser(userId: string): Promise<Reserva[]> {
    const reservas = await this.reservaModel
      .find({ usuario: userId })
      .sort({ createdAt: -1 })
      .exec();

    // Converter _id para id para compatibilidade com frontend
    return reservas.map((reserva) => ({
      ...reserva.toObject(),
      id: reserva._id.toString(),
    }));
  }

  async findById(
    id: string,
    options: { session?: any } = {},
  ): Promise<ReservaDocument> {
    const reserva = await this.reservaModel
      .findById(id)
      .sort({ createdAt: -1 })
      .populate('usuario')
      .session(options.session || null)
      .exec();

    if (!reserva) {
      throw new NotFoundException(`Reserva com ID "${id}" não encontrada`);
    }

    return reserva;
  }

  async findByCodigo(codigo: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel
      .findOne({ codigo })
      .populate('usuario')
      .exec();

    if (!reserva) {
      throw new NotFoundException(
        `Reserva com código "${codigo}" não encontrada`,
      );
    }
    return reserva;
  }

  // Usado pela rota pública GET /reservas/codigo/:codigo (tela de retorno do
  // checkout do Asaas, onde só temos o código, sem o e-mail do hóspede). O
  // código é sequencial e adivinhável (RES1001, RES1002...), então essa
  // consulta NUNCA pode devolver dados do hóspede (nome, e-mail, CPF,
  // telefone, endereço) nem o documento `usuario` populado — só o resumo
  // que a tela de sucesso de pagamento realmente exibe.
  async findByCodigoPublico(codigo: string): Promise<Partial<Reserva>> {
    const reserva = await this.reservaModel
      .findOne(
        { codigo },
        {
          codigo: 1,
          tipo: 1,
          dataInicio: 1,
          dataFim: 1,
          valorTotal: 1,
          statusReserva: 1,
        },
      )
      .lean()
      .exec();

    if (!reserva) {
      throw new NotFoundException(
        `Reserva com código "${codigo}" não encontrada`,
      );
    }
    return reserva;
  }

  async findByCodigoAndEmail(
    codigo: string,
    email: string,
  ): Promise<ReservaDocument> {
    const reserva = await this.reservaModel
      .findOne({
        codigo,
        usuarioEmail: email,
      })
      .populate('usuario')
      .populate('pagamento')
      .exec();

    if (!reserva) {
      throw new NotFoundException(
        `Reserva com código "${codigo}" e email "${email}" não encontrada`,
      );
    }
    return reserva;
  }

  async findByData(data: any): Promise<ReservaDocument[]> {
    const dataConsulta = new Date(data);
    dataConsulta.setHours(0, 0, 0, 0);

    return this.reservaModel.find(data).populate('usuario').exec();
  }

  createReserva(
    data: Partial<Reserva>,
    options: { session?: any } = {},
  ): Promise<Reserva> {
    const reserva = new this.reservaModel(data);
    return reserva.save({ session: options.session });
  }

  cancelReserva(
    reservaId: string,
    reservaDto: Reserva,
  ): Promise<Reserva | null> {
    return this.reservaModel
      .findByIdAndUpdate(reservaId, reservaDto, { new: true })
      .populate('usuario')
      .exec();
  }

  updateReserva(
    reservaId: string,
    dto: Partial<Reserva>,
    options = {},
  ): Promise<Reserva | null> {
    return this.reservaModel
      .findByIdAndUpdate(reservaId, dto, { new: true, ...options })
      .populate('usuario')
      .exec();
  }

  async findByPagamentoId(
    pagamentoId: string,
  ): Promise<ReservaDocument | null> {
    return this.reservaModel.findOne({ pagamento: pagamentoId }).exec();
  }

  // Método para atualizar o status de uma reserva
  async atualizarStatus(
    reservaId: string,
    novoStatus: StatusReserva,
    detalhes: string,
  ): Promise<ReservaDocument> {
    const novaEntradaHistorico = {
      data: new Date(),
      acao: `Status alterado para ${novoStatus}`,
      detalhes,
    };

    return this.reservaModel
      .findByIdAndUpdate(
        reservaId,
        {
          $set: { statusReserva: novoStatus },
          $push: { historico: novaEntradaHistorico },
        },
        { new: true },
      )
      .exec();
  }
  getHistorico(reservaId: string): Promise<HistoricoReserva[]> {
    const historico = this.findById(reservaId)
      .then((reserva) => {
        if (!reserva) {
          throw new NotFoundException(
            `Reserva com ID "${reservaId}" não encontrada`,
          );
        }
        return reserva.historico;
      })
      .catch((error) => {
        throw new NotFoundException(
          `Erro ao buscar histórico: ${error.message}`,
        );
      });
    return historico;
  }

  async verificarDisponibilidade(
    data: Date,
    tipo: string,
    quantidadeChales: number = 0,
  ): Promise<ReservaDocument[]> {
    const dataConsulta = new Date(data);
    dataConsulta.setHours(0, 0, 0, 0);

    const reservas = await this.reservaModel
      .find({
        dataInicio: { $lte: dataConsulta },
        dataFim: { $gte: dataConsulta },
        tipo,
      })
      .exec();

    return reservas;
  }

  /**
   * Busca reservas confirmadas para bloquear datas no calendário
   */
  async findReservasConfirmadas(): Promise<any[]> {
    const reservas = await this.reservaModel
      .find({ statusReserva: 'CONFIRMADA' })
      .select('dataInicio dataFim tipo')
      .exec();

    // Converter _id para id para compatibilidade com frontend
    return reservas.map((reserva) => ({
      ...reserva.toObject(),
      id: reserva._id.toString(),
    }));
  }
}
