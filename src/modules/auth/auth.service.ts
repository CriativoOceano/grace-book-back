// src/modules/auth/auth.service.ts
import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { UsuarioDocument } from 'src/schemas/usuario.schema';
import { EmailsService } from '../emails/email.service';
import { CodigosAcessoService } from '../codigos-acesso/codigos-acesso.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly emailsService: EmailsService,
    private readonly codigosAcessoService: CodigosAcessoService,
  ) {}

  async validateUser(emailOrCpf: string, pass: string): Promise<any> {
    try {
      // Tentar buscar por email (com o hash da senha selecionado — o
      // schema esconde `senha` por padrão nas outras consultas)
      const usuario = await this.usuariosService
        .findByEmailComSenha(emailOrCpf)
        .catch(() => this.usuariosService.findByCpfComSenha(emailOrCpf));

      if (usuario && (await usuario.compararSenha(pass))) {
        const usuarioDoc = usuario as UsuarioDocument;
        const { senha, ...result } = usuarioDoc.toObject();
        return result;
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `Falha ao validar usuário "${emailOrCpf}": ${error.message}`,
      );
      return null;
    }
  }

  // Assina o JWT e devolve junto o instante exato (ms) em que ele expira,
  // lido de volta do próprio token — o front usa isso pra saber quando a
  // sessão vence sem precisar decodificar o JWT (que agora vive só num
  // cookie httpOnly, inacessível a JS).
  private assinarComExpiracao(payload: Record<string, unknown>) {
    const access_token = this.jwtService.sign(payload);
    const decoded = this.jwtService.decode(access_token) as { exp: number };
    return { access_token, expiresAt: decoded.exp * 1000 };
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id, isAdmin: user.isAdmin };

    // Atualizar último acesso
    await this.usuariosService.atualizarUltimoAcesso(user._id);

    const { access_token, expiresAt } = this.assinarComExpiracao(payload);

    return {
      access_token,
      expiresAt,
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    };
  }

  async loginComCodigo(identificador: string, codigo: string) {
    const codigoValido = await this.usuariosService.verificarCodigoAcesso(
      identificador,
      codigo,
    );

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
    const payload = {
      email: usuario.email,
      sub: usuario._id,
      isAdmin: usuario.isAdmin,
    };

    // Atualizar último acesso
    await this.usuariosService.atualizarUltimoAcesso(usuario._id);

    const { access_token, expiresAt } = this.assinarComExpiracao(payload);

    return {
      access_token,
      expiresAt,
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
      const codigo =
        await this.usuariosService.gerarCodigoAcesso(identificador);

      // Buscar usuário para obter email
      let usuario;
      try {
        usuario = await this.usuariosService.findByEmail(identificador);
      } catch (error) {
        usuario = await this.usuariosService.findByCpf(identificador);
      }

      // Enviar email com o código
      await this.emailsService.enviarCodigoAcesso(
        usuario.email,
        usuario.nome,
        codigo,
      );

      return {
        message: 'Código de acesso enviado para o email cadastrado',
        email: this.ocultarEmail(usuario.email),
      };
    } catch (error) {
      throw new BadRequestException(
        'Não foi possível gerar o código de acesso',
      );
    }
  }

  // Função para ocultar parte do email para exibição
  private ocultarEmail(email: string): string {
    const [username, domain] = email.split('@');
    const maskedUsername =
      username.substring(0, 8) + '*'.repeat(username.length - 2);
    return `${maskedUsername}@${domain}`;
  }

  // Login admin com código nomeado — cada código pertence a uma pessoa
  // (CodigosAcessoService), então o JWT carrega o nome de quem está
  // logando em vez de uma identidade genérica fixa. Isso é o que dá
  // rastreabilidade: qualquer ação administrativa feita com esse token
  // pode ser atribuída a essa pessoa (ver req.user.nome nos controllers).
  async loginAdmin(codigo: string) {
    const codigoAcesso = await this.codigosAcessoService.validarCodigo(codigo);

    if (!codigoAcesso) {
      throw new UnauthorizedException('Código de acesso inválido');
    }

    const payload = {
      sub: codigoAcesso._id.toString(),
      nome: codigoAcesso.nome,
      isAdmin: true,
    };

    const { access_token, expiresAt } = this.assinarComExpiracao(payload);

    return {
      access_token,
      expiresAt,
      user: {
        id: codigoAcesso._id.toString(),
        nome: codigoAcesso.nome,
        email: '',
        isAdmin: true,
      },
    };
  }
}
