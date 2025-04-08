import { Provider } from '@nestjs/common';
import { PagamentoRepository } from './pagamento.repository';

export const PAGAMENTO_REPOSITORY = 'IPagamentoRepository';

export const pagamentoRepositoryProvider: Provider = {
  provide: PAGAMENTO_REPOSITORY,
  useClass: PagamentoRepository,
};