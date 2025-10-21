import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UpdateConfiguracaoDto } from './DTO/update-configuracoes.dto';
import { ConfiguracoesController } from './controllers/configuracoes.controller';
import { ConfiguracoesService } from './configuracoes.service';
import { Configuracao, ConfiguracaoSchema } from 'src/schemas/config.schema';
import { configuracoesRepositoryProvider } from './repositories/configuracaoes-repository.provider';
import { ConfiguracoesRepository } from './repositories/configuracoes.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Configuracao.name, schema: ConfiguracaoSchema }
    ])
  ],
  controllers: [ConfiguracoesController],
  providers: [ConfiguracoesService, configuracoesRepositoryProvider, ConfiguracoesRepository],
  exports: [ConfiguracoesService]
})
export class ConfiguracoesModule {
  static forFeature() {
      return {
        module: ConfiguracoesModule,
        imports: [], // Imports mínimos necessários
        providers: [ConfiguracoesService, configuracoesRepositoryProvider],
        exports: [ConfiguracoesService, configuracoesRepositoryProvider],
      };
    }
}