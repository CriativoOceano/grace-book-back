import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PrecosCalendarioDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  ano: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @IsIn(['diaria', 'chale', 'batismo', 'completo'])
  tipo: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantidadePessoas?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantidadeChales?: number;
}
