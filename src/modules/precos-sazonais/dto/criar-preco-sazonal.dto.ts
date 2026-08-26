import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class CriarPrecoSazonalDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  nome: string;

  @IsISO8601()
  dataInicio: string;

  @IsISO8601()
  dataFim: string;

  @IsIn(['percentual', 'fixo'])
  tipoAjuste: 'percentual' | 'fixo';

  @IsNumber()
  valorAjuste: number;
}
