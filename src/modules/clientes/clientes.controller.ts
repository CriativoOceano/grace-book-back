import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto';
import { UpdateUsuarioDto } from '../usuarios/dto/update-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

export interface ClienteResponse {
  success: boolean;
  data?: any | null;
  message?: string;
  error?: string;
}

// Toda esta rota expõe dados pessoais (incluindo, historicamente, hash de
// senha) de todos os usuários — não é usada por nenhum fluxo público do
// front-end hoje (o ClienteService do Angular está órfão), então fica
// inteira atrás de admin em vez de ficar aberta "só por enquanto".
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('api/clientes')
export class ClientesController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createClienteDto: CreateUsuarioDto,
  ): Promise<ClienteResponse> {
    try {
      const usuario = await this.usuariosService.create(createClienteDto);
      return {
        success: true,
        data: usuario,
        message: 'Cliente criado com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Erro ao criar cliente',
      };
    }
  }

  @Get('email/:email')
  async getByEmail(@Param('email') email: string): Promise<ClienteResponse> {
    try {
      const usuario = await this.usuariosService.findByEmail(email);
      if (usuario) {
        return {
          success: true,
          data: usuario,
          message: 'Cliente encontrado',
        };
      } else {
        return {
          success: false,
          data: null,
          message: 'Cliente não encontrado',
        };
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Erro ao buscar cliente',
      };
    }
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ClienteResponse> {
    try {
      const usuario = await this.usuariosService.findById(id);
      if (usuario) {
        return {
          success: true,
          data: usuario,
          message: 'Cliente encontrado',
        };
      } else {
        return {
          success: false,
          data: null,
          message: 'Cliente não encontrado',
        };
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Erro ao buscar cliente',
      };
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateClienteDto: UpdateUsuarioDto,
  ): Promise<ClienteResponse> {
    try {
      const usuario = await this.usuariosService.update(id, updateClienteDto);
      return {
        success: true,
        data: usuario,
        message: 'Cliente atualizado com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Erro ao atualizar cliente',
      };
    }
  }

  @Get()
  async getAll(): Promise<ClienteResponse> {
    try {
      const usuarios = await this.usuariosService.findAll();
      return {
        success: true,
        data: usuarios,
        message: 'Clientes listados com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Erro ao listar clientes',
      };
    }
  }
}
