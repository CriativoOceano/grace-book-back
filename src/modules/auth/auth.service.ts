// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { UsuarioDocument } from 'src/schemas/usuario.schema';
import { EmailsService } from '../emails/email.service';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly emailsService: EmailsService,
    private readonly configuracoesService: ConfiguracoesService,
  ) {}

  async validateUser(emailOrCpf: string, pass: string): Promise<any> {
    try {
      // Tentar buscar por email
      const usuario = await this.usuariosService.findByEmail(emailOrCpf)
        .catch(() => this.usuariosService.findByCpf(emailOrCpf));

      if (usuario && await usuario.compararSenha(pass)) {
        const usuarioDoc = usuario as UsuarioDocument;
        const { senha, ...result } = usuarioDoc.toObject();
        return result;
      }
      return null;
    } catch (error) {
      console.error('Erro ao validar usuário:', error);
    }
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id, isAdmin: user.isAdmin };
    
    // Atualizar último acesso
    await this.usuariosService.atualizarUltimoAcesso(user._id);
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    };
  }

  async loginComCodigo(identificador: string, codigo: string) {
    const codigoValido = await this.usuariosService.verificarCodigoAcesso(identificador, codigo);
    
    if (!codigoValido) {
      throw new UnauthorizedException('Código de acesso inválido ou expirado');
    }
    
    // Buscar o usuário pelo identificador (email ou CPF)
    let usuario;
    try {
      usuario = await this.usuariosService.findByEmail(identificador);
    } catch (error) {
      usuario = await this.usuariosService.findByCpf(identificador);
    }

    // Gerar token JWT
    const payload = { email: usuario.email, sub: usuario._id, isAdmin: usuario.isAdmin };
    
    // Atualizar último acesso
    await this.usuariosService.atualizarUltimoAcesso(usuario._id);
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        isAdmin: usuario.isAdmin,
      },
    };
  }

  async solicitarCodigoAcesso(identificador: string) {
    try {
      // Gerar código de acesso
      const codigo = await this.usuariosService.gerarCodigoAcesso(identificador);
      
      // Buscar usuário para obter email
      let usuario;
      try {
        usuario = await this.usuariosService.findByEmail(identificador);
      } catch (error) {
        usuario = await this.usuariosService.findByCpf(identificador);
      }
      
      // Enviar email com o código
      await this.emailsService.enviarCodigoAcesso(usuario.email, usuario.nome, codigo);
      
      return { 
        message: 'Código de acesso enviado para o email cadastrado',
        email: this.ocultarEmail(usuario.email)
      };
    } catch (error) {
      throw new BadRequestException('Não foi possível gerar o código de acesso');
    }
  }

  // Função para ocultar parte do email para exibição
  private ocultarEmail(email: string): string {
    const [username, domain] = email.split('@');
    const maskedUsername = username.substring(0, 8) + '*'.repeat(username.length - 2);
    return `${maskedUsername}@${domain}`;
  }

  // Método para validar código de acesso admin
  async validateAdminCode(codigo: string): Promise<boolean> {
    try {
      const configuracao = await this.configuracoesService.findAll();
      return await bcrypt.compare(codigo, configuracao.adminAccessCode);
    } catch (error) {
      console.error('Erro ao validar código admin:', error);
      return false;
    }
  }

  // Método para login admin com código
  async loginAdmin(codigo: string) {
    const codigoValido = await this.validateAdminCode(codigo);
    
    if (!codigoValido) {
      throw new UnauthorizedException('Código de acesso inválido');
    }
    
    // Gerar token JWT para admin
    const payload = { 
      sub: 'admin', 
      email: 'admin@fontedagraca.com.br', 
      isAdmin: true 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: 'admin',
        nome: 'Administrador',
        email: 'admin@fontedagraca.com.br',
        isAdmin: true,
      },
    };
  }
}