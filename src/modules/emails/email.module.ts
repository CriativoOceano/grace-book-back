import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailsService } from './email.service';
import { TestEmailController } from './controllers/test-email.controller';

@Module({
  imports: [ConfigModule],
  controllers: [TestEmailController],
  providers: [EmailsService],
  exports: [EmailsService],
})
export class EmailsModule {}