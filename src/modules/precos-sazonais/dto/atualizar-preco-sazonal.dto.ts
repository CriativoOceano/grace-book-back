import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AtualizarPrecoSazonalDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nome?: string;

  @IsOptional()
  @IsISO8601()
  dataInicio?: string;

  @IsOptional()
  @IsISO8601()
  dataFim?: string;

  @IsOptional()
  @IsIn(['percentual', 'fixo'])
  tipoAjuste?: 'percentual' | 'fixo';

  @IsOptional()
  @IsNumber()
  valorAjuste?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
