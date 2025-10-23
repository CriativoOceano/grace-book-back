import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IPagamentoRepository } from './interfaces/pagamento-repository.interface';
import { Pagamento, PagamentoDocument } from 'src/schemas/pagamentos.schema';
import { StatusPagamento } from '../pagamento.enums';

@Injectable()
export class PagamentoRepository implements IPagamentoRepository {
  private readonly logger = new Logger(PagamentoRepository.name);

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

  async findById(id: string): Promise<Pagamento | null> {
    return this.pagamentoModel.findById(id).exec();
  }

  async findByReservaId(reservaId: string): Promise<Pagamento[]> {
    // Converte string para ObjectId se necessário
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
    pagamentoId: string, 
    dadosAtualizacao: Partial<Pagamento>
  ): Promise<PagamentoDocument> {
    return this.pagamentoModel.findByIdAndUpdate(
      pagamentoId,
      { $set: dadosAtualizacao },
      { new: true }
    ).exec();
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

  // Método para encontrar pagamento pelo ID externo (checkoutId do Asaas)
  async findByExternalId(externalId: string): Promise<PagamentoDocument | null> {
    return this.pagamentoModel.findOne({ 'detalhes.id': externalId }).exec();
  }

  // Método para encontrar pagamento pelo Checkout Session ID
  async findByCheckoutSessionId(checkoutSessionId: string): Promise<PagamentoDocument | null> {
    return this.pagamentoModel.findOne({ asaasCheckoutSessionId: checkoutSessionId }).exec();
  }

  // Método para encontrar pagamento pelo Payment ID
  async findByPaymentId(paymentId: string): Promise<PagamentoDocument | null> {
    return this.pagamentoModel.findOne({ asaasPaymentId: paymentId }).exec();
  }

  // Método para encontrar pagamento por qualquer ID do ASAAS
  async findByAsaasId(asaasId: string): Promise<PagamentoDocument | null> {
    this.logger.log(`🔍 Buscando pagamento pelo ID: ${asaasId}`);
    
    // Primeiro tenta buscar pelo Payment ID
    let pagamento = await this.findByPaymentId(asaasId);
    if (pagamento) {
      this.logger.log(`✅ Pagamento encontrado pelo Payment ID: ${asaasId}`);
      return pagamento;
    }

    // Se não encontrar, tenta pelo Checkout Session ID
    pagamento = await this.findByCheckoutSessionId(asaasId);
    if (pagamento) {
      this.logger.log(`✅ Pagamento encontrado pelo Checkout Session ID: ${asaasId}`);
      return pagamento;
    }

    // Se não encontrar, tenta pelo campo antigo (compatibilidade)
    pagamento = await this.pagamentoModel.findOne({ asaasPagamentoId: asaasId }).exec();
    if (pagamento) {
      this.logger.log(`✅ Pagamento encontrado pelo campo asaasPagamentoId: ${asaasId}`);
      return pagamento;
    }

    // Por último, tenta pelo campo detalhes.id (método antigo)
    pagamento = await this.findByExternalId(asaasId);
    if (pagamento) {
      this.logger.log(`✅ Pagamento encontrado pelo campo detalhes.id: ${asaasId}`);
      return pagamento;
    }

    this.logger.log(`❌ Pagamento não encontrado por nenhum método para ID: ${asaasId}`);
    return null;
  }

  // Método para migrar dados existentes e atualizar campos
  async migrarDadosExistentes(): Promise<void> {
    this.logger.log(`🔄 Iniciando migração de dados existentes...`);
    
    // Buscar pagamentos que não têm os novos campos preenchidos
    const pagamentosParaMigrar = await this.pagamentoModel.find({
      $or: [
        { asaasCheckoutSessionId: { $exists: false } },
        { asaasCheckoutSessionId: null },
        { asaasPaymentId: { $exists: false } },
        { asaasPaymentId: null }
      ]
    }).exec();

    this.logger.log(`📊 Encontrados ${pagamentosParaMigrar.length} pagamentos para migrar`);

    for (const pagamento of pagamentosParaMigrar) {
      const updateData: any = {};

      // Se tem asaasPagamentoId mas não tem asaasCheckoutSessionId, copiar
      if (pagamento.asaasPagamentoId && !pagamento.asaasCheckoutSessionId) {
        updateData.asaasCheckoutSessionId = pagamento.asaasPagamentoId;
        this.logger.log(`📝 Migrando checkoutSessionId para pagamento ${pagamento._id}: ${pagamento.asaasPagamentoId}`);
      }

      // Se tem detalhes.id mas não tem asaasCheckoutSessionId, usar detalhes.id
      if (pagamento.detalhes?.id && !pagamento.asaasCheckoutSessionId) {
        updateData.asaasCheckoutSessionId = pagamento.detalhes.id;
        this.logger.log(`📝 Migrando checkoutSessionId do detalhes.id para pagamento ${pagamento._id}: ${pagamento.detalhes.id}`);
      }

      if (Object.keys(updateData).length > 0) {
        await this.pagamentoModel.updateOne(
          { _id: pagamento._id },
          { $set: updateData }
        );
        this.logger.log(`✅ Pagamento ${pagamento._id} migrado com sucesso`);
      }
    }

    this.logger.log(`✅ Migração concluída! ${pagamentosParaMigrar.length} pagamentos processados`);
  }

  /**
   * Busca pagamentos expirados (pendentes há mais tempo que o limite especificado)
   */
  async findPagamentosExpirados(dataLimite: Date): Promise<PagamentoDocument[]> {
    this.logger.log(`🔍 Buscando pagamentos expirados antes de ${dataLimite.toISOString()}`);
    
    return this.pagamentoModel.find({
      status: StatusPagamento.PENDENTE,
      createdAt: { $lt: dataLimite }
    }).exec();
  }
}
