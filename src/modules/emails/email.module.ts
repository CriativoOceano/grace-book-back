import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { EmailsService } from './email.service';
import { TestEmailController } from './controllers/test-email.controller';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [TestEmailController],
  providers: [EmailsService],
  exports: [EmailsService],
})
export class EmailsModule {}