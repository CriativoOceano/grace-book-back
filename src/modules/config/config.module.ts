import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UpdateConfiguracaoDto } from './DTO/update-config.dto';
import { ConfiguracoesController } from './controllers/config.controller';
import { ConfiguracoesService } from './config.service';
import { ConfiguracaoSchema } from 'src/schemas/config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UpdateConfiguracaoDto.name, schema: ConfiguracaoSchema }
    ])
  ],
  controllers: [ConfiguracoesController],
  providers: [ConfiguracoesService],
  exports: [ConfiguracoesService]
})
export class ConfiguracoesModule {}