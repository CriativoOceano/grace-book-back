import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsString()
  @IsOptional()
  sobrenome?: string;

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

  // isAdmin propositalmente NÃO existe aqui: este DTO alimenta um endpoint
  // público de autocadastro (POST /usuarios) e nunca deve poder conceder
  // privilégio de admin a partir de dados enviados pelo cliente.
}
