import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  logger.log('Aplicação conectada ao MongoDB');
  
  await app.listen(3000);
  logger.log(`Aplicação rodando na porta 3000`);
}
bootstrap();
