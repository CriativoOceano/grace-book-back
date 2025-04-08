import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber, IsDate, Min, Max } from '@nestjs/class-validator';
import { Type } from 'class-transformer';
import { TipoReserva } from 'src/schemas/reserva.schema';

export class CreateReservaDto {
  @IsNotEmpty()
  @IsEnum(TipoReserva)
  tipo: TipoReserva;

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

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  quantidadeChales?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}