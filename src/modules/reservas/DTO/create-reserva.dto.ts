import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDate,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IDadosPagamento } from 'src/modules/pagamentos/interfaces/dados-pagamento.interface';
import { TipoReserva } from '../reserva.enums';
import { DadosHospede } from '../../../interfaces/dados-hospede.interface';

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

  // Opcional de propósito: o backend recalcula esse valor a partir de
  // dataInicio/dataFim em processarNovaReserva, então o front nunca
  // manda esse campo. Como @IsNotEmpty/obrigatório aqui rejeitava toda
  // reserva real antes mesmo de chegar nesse recálculo.
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantidadeDiarias?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  quantidadeChales?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsObject()
  dadosHospede?: DadosHospede;
}
