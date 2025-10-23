// src/modules/auth/strategies/local.strategy.ts
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ 
      usernameField: 'identificador', // Confirme que este campo corresponde ao seu frontend
      passwordField: 'password' // Confirme que este campo corresponde ao seu frontend
    });
  }

  async validate(identificador: string, password: string): Promise<any> {
    // Adicione logs para depuração
    const user = await this.authService.validateUser(identificador, password);
    if (!user) {
      // Log para entender onde falhous
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return user;
  }
}