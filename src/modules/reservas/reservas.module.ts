import { Module } from '@nestjs/common';
import { ReservasController } from './controllers/reservas.controller';
import { ReservasService } from './reservar.service';
import { SharedModule } from '../modules';
import { reservaRepositoryProvider } from './repositories/reserva-repository.provider';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module';

@Module({
  imports: [
    SharedModule,
    ConfiguracoesModule
  ],
  controllers: [ReservasController],
  providers: [ReservasService],
  exports: []
})
export class ReservasModule {
  static forFeature() {
    return {
      module: ReservasModule,
      imports: [],
      providers: [reservaRepositoryProvider],
      exports: [reservaRepositoryProvider]
    };
  }
}