import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PrecoSazonal,
  PrecoSazonalSchema,
} from 'src/schemas/preco-sazonal.schema';
import { PrecosSazonaisService } from './precos-sazonais.service';
import { PrecosSazonaisController } from './precos-sazonais.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrecoSazonal.name, schema: PrecoSazonalSchema },
    ]),
  ],
  controllers: [PrecosSazonaisController],
  providers: [PrecosSazonaisService],
  exports: [PrecosSazonaisService],
})
export class PrecosSazonaisModule {}
