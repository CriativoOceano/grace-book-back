import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CodigoAcesso,
  CodigoAcessoSchema,
} from 'src/schemas/codigo-acesso.schema';
import { CodigosAcessoService } from './codigos-acesso.service';
import { CodigosAcessoController } from './codigos-acesso.controller';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CodigoAcesso.name, schema: CodigoAcessoSchema },
    ]),
    ConfiguracoesModule,
  ],
  controllers: [CodigosAcessoController],
  providers: [CodigosAcessoService],
  exports: [CodigosAcessoService],
})
export class CodigosAcessoModule {}
