import { Reserva, ReservaDocument } from "src/schemas/reserva.schema";

export interface IReservaRepository {
  findAll(): Promise<Reserva[]>;
  findByUser(userId: string): Promise<ReservaDocument[]>;
  findById(id: string): Promise<ReservaDocument>;
  findByCodigo(codigoReserva: string): Promise<ReservaDocument>;
  createReserva(data: Partial<Reserva>, options?): Promise<Reserva>;
  updateReserva(reservaId: string, dto: Partial<Reserva>, options?): Promise<Reserva | null>;
  cancelReserva(reservaId: string, dto: Partial<Reserva>): Promise<Reserva | null>;
  verificarDisponibilidade(data: Date, tipo: string, quantidadeChales?: number): Promise<ReservaDocument[]>;
  findByData(data: Date): Promise<ReservaDocument[]>;
  getHistorico(reservaId: string): Promise<any[]>;
}