// src/domains/pagamentos/dto/update-pagamento.dto.ts
import { IsOptional, IsNumber, IsString, IsEnum, IsDate, Min, IsUrl } from '@nestjs/class-validator';
import { Type } from 'class-transformer';
import { StatusPagamento } from 'src/schemas/reserva.schema';

export class UpdatePagamentoDto {
  @IsOptional()
  @IsEnum(StatusPagamento)
  status?: StatusPagamento;

  @IsOptional()
  @IsString()
  asaasId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valor?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dataPagamento?: Date;

  @IsOptional()
  @IsString()
  comprovante?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  linkPagamento?: string;
}