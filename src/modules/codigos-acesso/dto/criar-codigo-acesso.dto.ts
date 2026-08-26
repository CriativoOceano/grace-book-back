import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CriarCodigoAcessoDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  nome: string;
}
