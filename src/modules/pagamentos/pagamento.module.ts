import { Module } from '@nestjs/common';
import { PagamentosController } from './controllers/pagamento.controller';
import { PagamentosService } from './pagamentos.service';
import { SharedModule } from '../modules';
import { PagamentoRepository } from './repositories/pagamento.repository';

@Module({
  imports: [
    SharedModule
  ],
  controllers: [PagamentosController],
  providers: [PagamentosService,
    {
      provide: 'IPagamentoRepository',
      useClass: PagamentoRepository,
    }],
  exports: []
})
export class PagamentosModule {}