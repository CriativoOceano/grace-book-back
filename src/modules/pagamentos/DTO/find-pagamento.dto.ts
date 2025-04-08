import { IsOptional, IsString, IsEnum, IsDateString } from '@nestjs/class-validator';
import { StatusPagamento } from 'src/schemas/reserva.schema';

export class FindPagamentoDto {
  @IsOptional()
  @IsString()
  reservaId?: string;

  @IsOptional()
  @IsEnum(StatusPagamento)
  status?: StatusPagamento;

  @IsOptional()
  @IsString()
  asaasId?: string;

  @IsOptional()
  @IsDateString()
  dataPagamentoInicio?: string;

  @IsOptional()
  @IsDateString()
  dataPagamentoFim?: string;
}