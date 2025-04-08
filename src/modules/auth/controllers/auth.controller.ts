import { 
  Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus, 
  UseGuards, 
  Request, 
  Logger
} from '@nestjs/common';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { AuthService } from '../auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('solicitar-codigo')
  @HttpCode(HttpStatus.OK)
  async solicitarCodigo(@Body() { identificador }: { identificador: string }) {
    return this.authService.solicitarCodigoAcesso(identificador);
  }

  @Post('login-codigo')
  @HttpCode(HttpStatus.OK)
  async loginComCodigo(
    @Body() { identificador, codigo }: { identificador: string; codigo: string },
  ) {
    return this.authService.loginComCodigo(identificador, codigo);
  }
}