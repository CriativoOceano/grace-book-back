import { Pagamento } from "src/schemas/pagamentos.schema";


export interface IPagamentoRepository {
  findAll(): Promise<Pagamento[]>;
  findOne(id: string): Promise<Pagamento | null>;
  findByReservaId(reservaId: string): Promise<Pagamento[]>;
  createPagamento(data: Partial<Pagamento>): Promise<Pagamento>;
  updatePagamento(id: string, data: Partial<Pagamento>): Promise<Pagamento | null>;
  cancelPagamento(id: string): Promise<boolean>;
  cancelarPagamentosPorReserva(reservaId: string): Promise<number>;
  
  // Métodos para buscar por diferentes IDs do ASAAS
  findByExternalId(externalId: string): Promise<Pagamento | null>;
  findByCheckoutSessionId(checkoutSessionId: string): Promise<Pagamento | null>;
  findByPaymentId(paymentId: string): Promise<Pagamento | null>;
  findByAsaasId(asaasId: string): Promise<Pagamento | null>;
  
  // Método para migrar dados existentes
  migrarDadosExistentes(): Promise<void>;
  
  // Método para buscar pagamentos expirados
  findPagamentosExpirados(dataLimite: Date): Promise<Pagamento[]>;
}