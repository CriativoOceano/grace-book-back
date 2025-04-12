import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber, IsDate, Min, Max, IsObject } from '@nestjs/class-validator';
import { Type } from 'class-transformer';
import { IDadosPagamento } from 'src/modules/pagamentos/interfaces/dados-pagamento.interface';
import { TipoReserva } from '../reserva.enums';

export class CreateReservaDto {
  @IsNotEmpty()
  @IsEnum(TipoReserva)
  tipo: TipoReserva;

  @IsNotEmpty()
  @IsObject()
  dadosPagamento: IDadosPagamento;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  dataInicio: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataFim?: Date;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  quantidadePessoas?: number;

  @IsNumber()
  @Min(1)
  quantidadeDiarias?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  quantidadeChales?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}