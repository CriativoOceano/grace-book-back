import { IsNotEmpty, IsString, IsEnum, IsNumber, IsOptional } from '@nestjs/class-validator';
import { StatusPagamento } from '../pagamento.enums';

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