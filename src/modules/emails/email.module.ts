import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailsService } from './email.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailsService],
  exports: [EmailsService],
})
export class EmailsModule {}