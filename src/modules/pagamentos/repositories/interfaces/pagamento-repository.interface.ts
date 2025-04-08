import { Pagamento } from "src/schemas/pagamentos.schema";


export interface IPagamentoRepository {
  findAll(): Promise<Pagamento[]>;
  findOne(id: string): Promise<Pagamento | null>;
  findByReservaId(reservaId: string): Promise<Pagamento[]>;
  createPagamento(data: Partial<Pagamento>): Promise<Pagamento>;
  updatePagamento(id: string, data: Partial<Pagamento>): Promise<Pagamento | null>;
  cancelPagamento(id: string): Promise<boolean>;
  cancelarPagamentosPorReserva(reservaId: string): Promise<number>;
}