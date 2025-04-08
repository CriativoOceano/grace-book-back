import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IReservaRepository } from './interfaces/reserva-repository.interface';
import { Reserva, ReservaDocument } from 'src/schemas/reserva.schema';

@Injectable()
export class ReservaRepository implements IReservaRepository {
  constructor(
    @InjectModel(Reserva.name) private reservaModel: Model<ReservaDocument>,
  ) {}

  async findAll(): Promise<Reserva[]> {
    return this.reservaModel.find().populate('usuario').exec();
  }

  async findByUser(userId: string): Promise<ReservaDocument[]> {
    return this.reservaModel.find({ usuario: userId }).exec();
  }

  async findById(id: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel
      .findById(id)
      .populate('usuario')
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

  async findByData(data: any): Promise<ReservaDocument[]> {
    const dataConsulta = new Date(data);
    dataConsulta.setHours(0, 0, 0, 0);

    return this.reservaModel
      .find(data)
      .populate('usuario')
      .exec();
  }

  createReserva(data: Partial<Reserva>): Promise<Reserva> {
    const reserva = new this.reservaModel(data);
    return reserva.save();
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
  ): Promise<Reserva | null> {
    return this.reservaModel
      .findByIdAndUpdate(reservaId, dto, { new: true })
      .populate('usuario')
      .exec();
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
}
