import { IsOptional, IsString, IsEnum, IsNumber, IsDate, Min, Max } from '@nestjs/class-validator';
import { Type } from 'class-transformer';
import { TipoReserva } from '../reserva.enums';

export class UpdateReservaDto {
  @IsOptional()
  @IsEnum(TipoReserva)
  tipo?: TipoReserva;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataInicio?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataFim?: Date;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  quantidadePessoas?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  quantidadeChales?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}