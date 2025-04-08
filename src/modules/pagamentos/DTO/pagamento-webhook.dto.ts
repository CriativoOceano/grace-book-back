import { IsNotEmpty, IsString, IsEnum, IsNumber, IsOptional } from '@nestjs/class-validator';
import { StatusPagamento } from 'src/schemas/reserva.schema';

export class PagamentoWebhookDto {
  @IsNotEmpty()
  @IsString()
  asaasId: string;

  @IsNotEmpty()
  @IsEnum(StatusPagamento)
  status: StatusPagamento;

  @IsOptional()
  @IsNumber()
  valor?: number;

  @IsOptional()
  @IsString()
  comprovante?: string;
}