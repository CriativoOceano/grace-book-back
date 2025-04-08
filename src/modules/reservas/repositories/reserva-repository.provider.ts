import { Provider } from '@nestjs/common';
import { ReservaRepository } from './reserva.repository';

export const RESERVA_REPOSITORY = 'IReservaRepository';

export const reservaRepositoryProvider: Provider = {
  provide: RESERVA_REPOSITORY,
  useClass: ReservaRepository,
};