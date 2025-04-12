import { Module } from '@nestjs/common';
import { PagamentosController } from './controllers/pagamento.controller';
import { PagamentosService } from './pagamentos.service';
import { SharedModule } from '../modules';
import { pagamentoRepositoryProvider } from './repositories/pagamento-repository.provider';

@Module({
  imports: [
    SharedModule,
  ],
  controllers: [PagamentosController],
  providers: [PagamentosService],
  exports: []
})
export class PagamentosModule {
  static forFeature() {
    return {
      module: PagamentosModule,
      imports: [], // Imports mínimos necessários
      providers: [PagamentosService, pagamentoRepositoryProvider],
      exports: [PagamentosService, pagamentoRepositoryProvider]
    };
  }
}