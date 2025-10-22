import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [UsuariosModule],
  controllers: [ClientesController],
})
export class ClientesModule {}
