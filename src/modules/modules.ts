import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reserva, ReservaSchema } from 'src/schemas/reserva.schema';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ConfiguracoesModule } from './config/config.module';
import { EmailsModule } from './emails/email.module';
import { HttpModule } from '@nestjs/axios';
import { Pagamento, PagamentoSchema } from 'src/schemas/pagamentos.schema';
import { pagamentoRepositoryProvider } from './pagamentos/repositories/pagamento-repository.provider';
import { reservaRepositoryProvider } from './reservas/repositories/reserva-repository.provider';
import { AuthModule } from './auth/auth.module';
import { UsuariosService } from './usuarios/usuarios.service';
import { EmailsService } from './emails/email.service';
import { ConfiguracoesService } from './config/config.service';
import { ReservaRepository } from './reservas/repositories/reserva.repository';
import { ReservaProcessoService } from 'src/shared/services/reserva-processo.service';
import { Usuario, UsuarioSchema } from 'src/schemas/usuario.schema';
import { Configuracao, ConfiguracaoSchema } from 'src/schemas/config.schema';
import { UpdateConfiguracaoDto } from './config/DTO/update-config.dto';
import { ConfigService } from '@nestjs/config';
import { PagamentosService } from './pagamentos/pagamentos.service';
import { PagamentoRepository } from './pagamentos/repositories/pagamento.repository';

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
      { name: UpdateConfiguracaoDto.name, schema: ConfiguracaoSchema }
    ]),
  ],
  providers: [
    pagamentoRepositoryProvider,
    reservaRepositoryProvider,
    UsuariosService,
    ConfiguracoesService,
    EmailsService,
    ReservaRepository,
    ReservaProcessoService,
    ConfigService,
    PagamentosService,
    PagamentoRepository,
  ],
  exports: [
    MongooseModule,
    pagamentoRepositoryProvider,
    reservaRepositoryProvider,
    UsuariosService,
    ConfiguracoesService,
    EmailsService,
    ReservaRepository,
    ReservaProcessoService,
    ConfigService,
    PagamentosService,
    PagamentoRepository,
    MongooseModule.forFeature([
      { name: Reserva.name, schema: ReservaSchema },
      { name: Pagamento.name, schema: PagamentoSchema },
      { name: Usuario.name, schema: UsuarioSchema },
      { name: UpdateConfiguracaoDto.name, schema: ConfiguracaoSchema },
    ]),
  ],
})
export class SharedModule {}
