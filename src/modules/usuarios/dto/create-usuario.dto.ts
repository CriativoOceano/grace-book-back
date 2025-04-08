import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "@nestjs/class-validator";

export class CreateUsuarioDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  cpf: string;

  @IsString()
  @IsOptional()
  telefone?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  senha?: string;

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}