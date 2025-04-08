import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IPagamentoRepository } from './interfaces/pagamento-repository.interface';
import { Pagamento, PagamentoDocument } from 'src/schemas/pagamentos.schema';

@Injectable()
export class PagamentoRepository implements IPagamentoRepository {
  constructor(
    @InjectModel(Pagamento.name)
    private pagamentoModel: Model<PagamentoDocument>,
  ) {}

  async findAll(): Promise<Pagamento[]> {
    return this.pagamentoModel.find().exec();
  }

  async findOne(id: string): Promise<Pagamento | null> {
    return this.pagamentoModel.findById(id).exec();
  }

  async findByReservaId(reservaId: string): Promise<Pagamento[]> {
    const objectId = this.isValidObjectId(reservaId)
      ? new Types.ObjectId(reservaId)
      : reservaId;

    return this.pagamentoModel.find({ reservaId: objectId }).exec();
  }

  async createPagamento(data: Partial<Pagamento>): Promise<Pagamento> {
    const novoPagamento = new this.pagamentoModel(data);
    return novoPagamento.save();
  }

  async updatePagamento(
    id: string,
    data: Partial<Pagamento>,
  ): Promise<Pagamento | null> {
    return this.pagamentoModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
  }

  async cancelPagamento(id: string): Promise<boolean> {
    const resultado = await this.pagamentoModel.deleteOne({ _id: id }).exec();
    return resultado.deletedCount > 0;
  }

  async cancelarPagamentosPorReserva(reservaId: string): Promise<number> {
    const resultado = await this.pagamentoModel
      .updateMany(
        {
          reservaId: reservaId,
          status: { $ne: 'CANCELADO' }, // Não atualiza pagamentos já cancelados
        },
        {
          status: 'CANCELADO',
          dataAtualizacao: new Date(),
        },
      )
      .exec();

    return resultado.modifiedCount;
  }
  
  private isValidObjectId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }
}
