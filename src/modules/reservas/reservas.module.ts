import { Module } from '@nestjs/common';
import { ReservasController } from './controllers/reservas.controller';
import { ReservasService } from './reservar.service';
import { SharedModule } from '../modules';
import { ReservaRepository } from './repositories/reserva.repository';

@Module({
  imports: [
    SharedModule
  ],
  controllers: [ReservasController],
  providers: [ReservasService,
    {
      provide: 'IReservaRepository',
      useClass: ReservaRepository,
    }],
  exports: []
})
export class ReservasModule {}