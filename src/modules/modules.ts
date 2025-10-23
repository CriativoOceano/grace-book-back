import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reserva, ReservaSchema } from 'src/schemas/reserva.schema';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ConfiguracoesModule } from './configuracoes/configuracoes.module';
import { EmailsModule } from './emails/email.module';
import { HttpModule } from '@nestjs/axios';
import { Pagamento, PagamentoSchema } from 'src/schemas/pagamentos.schema';
import { pagamentoRepositoryProvider } from './pagamentos/repositories/pagamento-repository.provider';
import { reservaRepositoryProvider } from './reservas/repositories/reserva-repository.provider';
import { AuthModule } from './auth/auth.module';
import { UsuariosService } from './usuarios/usuarios.service';
import { ReservaRepository } from './reservas/repositories/reserva.repository';
import { ReservaProcessoService } from 'src/modules/shared/services/reservaProcesso/reserva-processo.service';
import { Usuario, UsuarioSchema } from 'src/schemas/usuario.schema';
import { ConfigService } from '@nestjs/config';
import { PagamentosService } from './pagamentos/pagamentos.service';
import { PagamentoRepository } from './pagamentos/repositories/pagamento.repository';
import { CalculoReservaService } from './shared/services/reservaProcesso/calcular-reserva.service';
import { configuracoesRepositoryProvider } from './configuracoes/repositories/configuracaoes-repository.provider';
import { Configuracao, ConfiguracaoSchema } from 'src/schemas/config.schema';

@Module({
  imports: [
    UsuariosModule,
    ConfiguracoesModule,
    EmailsModule,
    AuthModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Reserva.name, schema: ReservaSchema },
      { name: Pagamento.name, schema: PagamentoSchema },
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Configuracao.name, schema: ConfiguracaoSchema }
    ]),
  ],
  providers: [
    ReservaRepository,
    PagamentoRepository,
    
    pagamentoRepositoryProvider,
    reservaRepositoryProvider,
    configuracoesRepositoryProvider,
  
    UsuariosService,
    ConfigService,
    PagamentosService,
    ReservaProcessoService,
    CalculoReservaService
  ],
  exports: [
    MongooseModule,
    HttpModule,
    
    ReservaRepository,
    PagamentoRepository,

    pagamentoRepositoryProvider,
    reservaRepositoryProvider,
    configuracoesRepositoryProvider,

    UsuariosService,
    PagamentosService,
    ConfigService,
    ReservaProcessoService,
    CalculoReservaService,

    MongooseModule.forFeature([
      { name: Reserva.name, schema: ReservaSchema },
      { name: Pagamento.name, schema: PagamentoSchema },
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Configuracao.name, schema: ConfiguracaoSchema }
    ]),
  ],
})
export class SharedModule {}