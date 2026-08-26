import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Necessário para o JwtStrategy conseguir ler o cookie httpOnly de sessão.
  app.use(cookieParser());

  // Defesa contra CSRF: com o token de sessão migrado para um cookie
  // httpOnly (para não ficar acessível a um XSS via localStorage), o
  // navegador passa a mandar esse cookie em qualquer requisição
  // cross-site, inclusive uma forjada por um site malicioso. Como
  // requisições "simples" de formulário HTML não conseguem definir um
  // header customizado, exigir X-Requested-With em toda mutação que
  // carregue o cookie de sessão bloqueia esse forjamento sem afetar as
  // rotas públicas de reserva (que não dependem do cookie).
  app.use((req, res, next) => {
    const metodosMutaveis = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const temCookieDeSessao = Boolean(req.cookies?.token);
    if (
      temCookieDeSessao &&
      metodosMutaveis.includes(req.method) &&
      req.headers['x-requested-with'] !== 'XMLHttpRequest'
    ) {
      res
        .status(403)
        .json({ message: 'Requisição bloqueada: origem não confiável.' });
      return;
    }
    next();
  });

  // Obter porta do ambiente ou usar padrão
  const port = process.env.PORT || 3000;

  // Configurar CORS para permitir requests do frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

  app.enableCors({
    origin: [
      'http://localhost:4200', // Angular dev server
      'http://127.0.0.1:4200', // Angular dev server (alternativo)
      'http://localhost:3000', // Backend (caso necessário)
      'https://sedecampestre.oceanodagraca.com', // Frontend em produção
      frontendUrl, // URL configurável via env
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true, // Permitir cookies/credenciais se necessário
  });

  logger.log(`CORS configurado para: ${frontendUrl}`);
  logger.log('Aplicação conectada ao MongoDB');

  await app.listen(port);
  logger.log(`Aplicação rodando na porta ${port}`);
}
bootstrap();
