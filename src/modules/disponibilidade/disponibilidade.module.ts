import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DisponibilidadeController } from './disponibilidade.controller';
import { DisponibilidadeService } from './disponibilidade.service';
import { Disponibilidade, DisponibilidadeSchema } from '../../schemas/disponibilidade.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Disponibilidade.name, schema: DisponibilidadeSchema }
    ])
  ],
  controllers: [DisponibilidadeController],
  providers: [DisponibilidadeService],
  exports: [DisponibilidadeService]
})
export class DisponibilidadeModule {}
