import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Obter porta do ambiente ou usar padrão
  const port = process.env.PORT || 3000;
  
  // Configurar CORS para permitir requests do frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  
  app.enableCors({
    origin: [
      'http://localhost:4200',  // Angular dev server
      'http://127.0.0.1:4200',  // Angular dev server (alternativo)
      'http://localhost:3000',  // Backend (caso necessário)
      'https://sedecampestre.netlify.app',  // Frontend em produção
      frontendUrl,  // URL configurável via env
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
