import { IsOptional, IsString, MaxLength } from '@nestjs/class-validator';

export class CancelarReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}