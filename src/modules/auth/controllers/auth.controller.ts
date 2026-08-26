import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { AuthService } from '../auth.service';

// Nome e opções do cookie httpOnly que carrega o JWT de sessão. httpOnly
// impede que um script injetado via XSS leia o token (o problema de
// guardá-lo em localStorage); secure+sameSite=none em produção porque o
// front (Netlify) e o back (Render) vivem em domínios diferentes. Em dev,
// sameSite=lax e sem secure, para funcionar em http://localhost — use o
// proxy do Angular (proxy.conf.json) pra manter front e back na mesma
// origem localmente, senão o navegador não guarda/envia o cookie entre
// portas diferentes.
const COOKIE_NAME = 'token';
const isProd = process.env.NODE_ENV === 'production';
const cookieOptionsBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
};

// Limite de tentativas (5/min, configurado em ThrottlerModule no
// app.module.ts) aplicado só neste controller — todas as rotas aqui são de
// autenticação, o alvo natural de brute force. Não é global de propósito:
// as rotas públicas de reserva/config são chamadas várias vezes por minuto
// pelo próprio front-end durante o fluxo normal de reserva.
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setAuthCookie(
    res: Response,
    access_token: string,
    expiresAt: number,
  ): void {
    res.cookie(COOKIE_NAME, access_token, {
      ...cookieOptionsBase,
      maxAge: expiresAt - Date.now(),
    });
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(req.user);
    this.setAuthCookie(res, result.access_token, result.expiresAt);
    return result;
  }

  @Post('solicitar-codigo')
  @HttpCode(HttpStatus.OK)
  async solicitarCodigo(@Body() { identificador }: { identificador: string }) {
    return this.authService.solicitarCodigoAcesso(identificador);
  }

  @Post('login-codigo')
  @HttpCode(HttpStatus.OK)
  async loginComCodigo(
    @Body()
    { identificador, codigo }: { identificador: string; codigo: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginComCodigo(identificador, codigo);
    this.setAuthCookie(res, result.access_token, result.expiresAt);
    return result;
  }

  @Post('admin-login')
  @HttpCode(HttpStatus.OK)
  async loginAdmin(
    @Body() { codigo }: { codigo: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginAdmin(codigo);
    this.setAuthCookie(res, result.access_token, result.expiresAt);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptionsBase });
    return { success: true };
  }

  @Get('admin-status')
  @HttpCode(HttpStatus.OK)
  async adminStatus() {
    return { message: 'Admin endpoint is working' };
  }
}
