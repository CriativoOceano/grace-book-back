import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from "@nestjs/class-validator";
import { Type } from 'class-transformer';

export class FaixaPrecoDto {
  @IsNumber()
  @Min(1)
  maxPessoas: number;

  @IsNumber()
  @Min(0)
  valor: number;
}

export class UpdateConfiguracaoDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaixaPrecoDto)
  precoDiaria?: FaixaPrecoDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoChale?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoBatismo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  qtdMaxPessoas?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantidadeMaximaChales?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  diasAntecedenciaMinima?: number;

  @IsOptional()
  @IsString()
  emailRemetente?: string;

  @IsOptional()
  @IsBoolean()
  manutencao?: boolean;
}