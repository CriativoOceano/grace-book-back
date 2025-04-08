// src/modules/usuarios/usuarios.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Usuario, UsuarioModel } from 'src/schemas/usuario.schema';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: UsuarioModel,
  ) {}

  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    // Verificar se já existe usuário com o mesmo CPF ou email
    const usuarioExistente = await this.usuarioModel.findOne({
      $or: [
        { email: createUsuarioDto.email },
        { cpf: createUsuarioDto.cpf },
      ],
    });

    if (usuarioExistente) {
      throw new ConflictException('Email ou CPF já cadastrado');
    }

    const createdUsuario = new this.usuarioModel(createUsuarioDto);
    return createdUsuario.save();
  }

  async findAll(): Promise<Usuario[]> {
    return this.usuarioModel.find().exec();
  }

  async findById(id: string): Promise<Usuario> {
    const usuario = await this.usuarioModel.findById(id).select('-senha').exec();
    if (!usuario) {
      throw new NotFoundException(`Usuário com ID "${id}" não encontrado`);
    }
    return usuario;
  }

  async findByEmail(email: string): Promise<Usuario> {
    const usuario = await this.usuarioModel.findOne({ email }).exec();
    console.log(usuario);
    if (!usuario) {
      throw new NotFoundException(`Usuário com email "${email}" não encontrado`);
    }
    return usuario;
  }

  async findByCpf(cpf: string): Promise<Usuario> {
    const usuario = await this.usuarioModel.findOne({ cpf }).exec();
    if (!usuario) {
      throw new NotFoundException(`Usuário com CPF "${cpf}" não encontrado`);
    }
    return usuario;
  }

  async update(id: string, updateUsuarioDto: UpdateUsuarioDto): Promise<Usuario> {
    const updatedUsuario = await this.usuarioModel
      .findByIdAndUpdate(id, updateUsuarioDto, { new: true }).select('-senha')
      .exec();
    
    if (!updatedUsuario) {
      throw new NotFoundException(`Usuário com ID "${id}" não encontrado`);
    }
    
    return updatedUsuario;
  }

  async remove(id: string): Promise<Usuario> {
    const deletedUsuario = await this.usuarioModel.findByIdAndDelete(id).select('-senha').exec();
    
    if (!deletedUsuario) {
      throw new NotFoundException(`Usuário com ID "${id}" não encontrado`);
    }
    
    return deletedUsuario;
  }

  async gerarCodigoAcesso(emailOuCpf: string): Promise<string> {
    const usuario = await this.usuarioModel.findOne({
      $or: [{ email: emailOuCpf }, { cpf: emailOuCpf }],
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Usar o método estático definido no schema
    return this.usuarioModel.gerarCodigoAcesso(usuario.email);
  }

  async verificarCodigoAcesso(emailOuCpf: string, codigo: string): Promise<boolean> {
    const usuario = await this.usuarioModel.findOne({
      $or: [{ email: emailOuCpf }, { cpf: emailOuCpf }],
      codigoAcesso: codigo,
      expiracaoCodigo: { $gt: new Date() }, // Verificar se o código não expirou
    });

    return !!usuario; // Retorna true se o usuário for encontrado, false caso contrário
  }

  async atualizarUltimoAcesso(id: string): Promise<void> {
    await this.usuarioModel.findByIdAndUpdate(id, {
      ultimoAcesso: new Date(),
    });
  }
}