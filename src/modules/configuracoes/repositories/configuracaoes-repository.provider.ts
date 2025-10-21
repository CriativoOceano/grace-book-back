import { Provider } from '@nestjs/common';
import { ConfiguracoesRepository, CONFIGURACOES_REPOSITORY } from './configuracoes.repository';
import { getModelToken } from '@nestjs/mongoose';
import { Configuracao } from '../../../schemas/config.schema';

export { CONFIGURACOES_REPOSITORY };

export const configuracoesRepositoryProvider: Provider = {
  provide: CONFIGURACOES_REPOSITORY,
  useFactory: (configuracaoModel) => new ConfiguracoesRepository(configuracaoModel),
  inject: [getModelToken(Configuracao.name)],
};