import { Module } from '@nestjs/common';
import { ReservaProcessoService } from './reserva-processo.service';
import { ReservasModule } from 'src/modules/reservas/reservas.module';
import { PagamentosModule } from 'src/modules/pagamentos/pagamento.module';
import { ConfiguracoesModule } from 'src/modules/configuracoes/configuracoes.module';

@Module({
  imports: [
    ReservasModule.forFeature(),
    PagamentosModule.forFeature(),
    ConfiguracoesModule.forFeature(),
  ],
  providers: [ReservaProcessoService],
  exports: [ReservaProcessoService],
})
export class ReservaProcessoModule {}