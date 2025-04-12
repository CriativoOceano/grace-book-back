import { Provider } from '@nestjs/common';
import { ConfiguracoesRepository } from './configuracoes.repository';

export const CONFIGURACOES_REPOSITORY = 'IConfiguracoesRepository';

export const configuracoesRepositoryProvider: Provider = {
  provide: CONFIGURACOES_REPOSITORY,
  useClass: ConfiguracoesRepository,
};