import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// O token de sessão agora vive num cookie httpOnly (não acessível a JS,
// diferente de localStorage) — lido daqui primeiro. O fallback pro header
// Authorization continua existindo por compatibilidade com qualquer
// chamador que não seja o navegador (ex.: um script/Postman do admin).
const extrairDoCookie = (req: Request): string | null =>
  (req?.cookies?.token as string | undefined) ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET não está configurado. Defina a variável de ambiente antes de subir a aplicação.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extrairDoCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      nome: payload.nome,
      isAdmin: payload.isAdmin,
    };
  }
}
