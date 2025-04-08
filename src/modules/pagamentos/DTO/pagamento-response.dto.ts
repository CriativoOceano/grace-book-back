import { Exclude, Expose, Transform } from 'class-transformer';
import { StatusPagamento } from 'src/schemas/reserva.schema';

export class PagamentoResponseDto {
  @Expose()
  id: string;

  @Expose()
  @Transform(({ value }) => value.toString())
  reservaId: string;

  @Expose()
  status: StatusPagamento;

  @Expose()
  asaasId: string;

  @Expose()
  valor: number;

  @Expose()
  dataPagamento: Date;

  @Expose()
  comprovante: string;

  @Expose()
  linkPagamento: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<PagamentoResponseDto>) {
    Object.assign(this, partial);
  }
}
