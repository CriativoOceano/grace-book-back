import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDate,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoReserva } from '../reserva.enums';

// getValorReserva() só usa esses campos pra calcular o preço — ao contrário
// de CreateReservaDto, não exige dadosPagamento/dadosHospede, que ainda não
// existem nesse momento do fluxo (o usuário está só vendo o preço, antes de
// preencher os dados de hóspede e pagamento).
export class CotarReservaDto {
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
  quantidadeDiarias?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  quantidadeChales?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
