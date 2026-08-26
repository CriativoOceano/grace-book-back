import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PrecoSazonal,
  PrecoSazonalDocument,
} from 'src/schemas/preco-sazonal.schema';
import { CriarPrecoSazonalDto } from './dto/criar-preco-sazonal.dto';
import { AtualizarPrecoSazonalDto } from './dto/atualizar-preco-sazonal.dto';

@Injectable()
export class PrecosSazonaisService {
  constructor(
    @InjectModel(PrecoSazonal.name)
    private readonly precoSazonalModel: Model<PrecoSazonalDocument>,
  ) {}

  async listar(): Promise<PrecoSazonal[]> {
    return this.precoSazonalModel.find().sort({ dataInicio: -1 }).lean();
  }

  async criar(
    dto: CriarPrecoSazonalDto,
    criadoPorNome: string,
  ): Promise<PrecoSazonal> {
    this.validarIntervalo(dto.dataInicio, dto.dataFim);

    return this.precoSazonalModel.create({
      ...dto,
      dataInicio: new Date(dto.dataInicio),
      dataFim: new Date(dto.dataFim),
      criadoPorNome,
    });
  }

  async atualizar(
    id: string,
    dto: AtualizarPrecoSazonalDto,
  ): Promise<PrecoSazonal> {
    if (dto.dataInicio && dto.dataFim) {
      this.validarIntervalo(dto.dataInicio, dto.dataFim);
    }

    const atualizado = await this.precoSazonalModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        ...(dto.dataInicio ? { dataInicio: new Date(dto.dataInicio) } : {}),
        ...(dto.dataFim ? { dataFim: new Date(dto.dataFim) } : {}),
      },
      { new: true },
    );

    if (!atualizado) {
      throw new NotFoundException('Regra de preço sazonal não encontrada');
    }

    return atualizado;
  }

  async remover(id: string): Promise<void> {
    const removido = await this.precoSazonalModel.findByIdAndDelete(id);
    if (!removido) {
      throw new NotFoundException('Regra de preço sazonal não encontrada');
    }
  }

  private validarIntervalo(dataInicio: string, dataFim: string): void {
    if (new Date(dataInicio) > new Date(dataFim)) {
      throw new BadRequestException(
        'A data de início não pode ser depois da data de fim',
      );
    }
  }
}
