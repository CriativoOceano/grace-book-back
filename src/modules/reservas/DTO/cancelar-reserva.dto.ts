import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelarReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
