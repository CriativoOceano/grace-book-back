import { IsNotEmpty, IsEnum, IsOptional, IsNumber, IsDate, Min, Max } from '@nestjs/class-validator';
import { Type } from 'class-transformer';
import { TipoReserva } from '../reserva.enums';

export class VerificarDisponibilidadeDto {
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  dataInicio: Date;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  dataFim: Date;

  @IsNotEmpty()
  @IsEnum(TipoReserva)
  tipo: TipoReserva;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  quantidadeChales?: number;
}