import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Min } from '@nestjs/class-validator';
import { Type } from 'class-transformer';
import { StatusPagamento } from 'src/schemas/reserva.schema';

export class CreatePagamentoDto {
  @IsNotEmpty()
  @IsString()
  reservaId: string;

  @IsOptional()
  @IsEnum(StatusPagamento)
  status?: StatusPagamento = StatusPagamento.PENDENTE;

  @IsOptional()
  @IsString()
  asaasId?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  valor: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dataPagamento?: Date;

  @IsOptional()
  @IsString()
  comprovante?: string;

  @IsNotEmpty()
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  linkPagamento: string;
}