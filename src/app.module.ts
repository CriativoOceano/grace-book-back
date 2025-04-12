import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharedModule } from './modules/modules';
import { ReservasModule } from './modules/reservas/reservas.module';
import { PagamentosModule } from './modules/pagamentos/pagamento.module';
import { ReservaProcessoModule } from './modules/shared/services/reservaProcesso/reserva-processo.module';

@Module({
  imports: [
    SharedModule,
    ReservasModule,
    PagamentosModule,
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // Configurar para o fuso horário de Brasília
        const BRASILIA_OFFSET = 0; // -3 horas em minutos
        const MINUTE_IN_MS = 60000; // 1 minuto em milissegundos

        // Sobrescrever o método toJSON do Date
        const originalDateToJSON = Date.prototype.toJSON;
        Date.prototype.toJSON = function () {
          const offsetSistema = this.getTimezoneOffset();
          const offsetDiferenca =
            (offsetSistema - BRASILIA_OFFSET) * MINUTE_IN_MS;
          const dataBrasilia = new Date(this.getTime() - offsetDiferenca);
          return originalDateToJSON.call(dataBrasilia);
        };

        return {
          uri: configService.get<string>('DATABASE_URL'),
          useNewUrlParser: true,
          useUnifiedTopology: true,
          // Se necessário, você pode adicionar outras configurações do Mongoose aqui
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
