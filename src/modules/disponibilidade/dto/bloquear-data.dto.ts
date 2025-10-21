import { IsNotEmpty, IsOptional, IsString, IsDate, IsBoolean, IsNumber, Min } from '@nestjs/class-validator';
import { Type } from 'class-transformer';

export class BloquearDataDto {
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  dataInicio: Date;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  dataFim: Date;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  disponibilidadeDiaria?: boolean;

  @IsOptional()
  @IsBoolean()
  disponibilidadeBatismo?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  chalesDisponiveis?: number;
}

export class UpdateDisponibilidadeDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataInicio?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataFim?: Date;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  disponibilidadeDiaria?: boolean;

  @IsOptional()
  @IsBoolean()
  disponibilidadeBatismo?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  chalesDisponiveis?: number;
}
