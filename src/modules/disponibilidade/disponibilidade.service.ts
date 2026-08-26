import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Disponibilidade,
  DisponibilidadeModel,
} from '../../schemas/disponibilidade.schema';
import { BloquearDataDto } from './dto/bloquear-data.dto';
import { UpdateDisponibilidadeDto } from './dto/update-disponibilidade.dto';

@Injectable()
export class DisponibilidadeService {
  private readonly logger = new Logger(DisponibilidadeService.name);

  constructor(
    @InjectModel(Disponibilidade.name)
    private disponibilidadeModel: DisponibilidadeModel,
  ) {}

  // Só os dias totalmente bloqueados (diária E batismo indisponíveis) —
  // é o que a tela "Bloquear Data" do admin cria. Bloqueios parciais (só
  // menos chalés disponíveis, por exemplo) não escondem o dia inteiro do
  // calendário público.
  async listarBloqueiosPublico(): Promise<{ data: Date }[]> {
    return this.disponibilidadeModel
      .find(
        { disponibilidadeDiaria: false, disponibilidadeBatismo: false },
        { data: 1, _id: 0 },
      )
      .lean();
  }

  async listarBloqueios(): Promise<Disponibilidade[]> {
    this.logger.log('Listando todos os bloqueios de disponibilidade');

    const bloqueios = await this.disponibilidadeModel
      .find()
      .sort({ data: 1 })
      .exec();

    return bloqueios;
  }

  async bloquearPeriodo(
    bloquearDataDto: BloquearDataDto,
  ): Promise<Disponibilidade> {
    this.logger.log(
      `Bloqueando período: ${bloquearDataDto.dataInicio} até ${bloquearDataDto.dataFim}`,
    );

    // dataInicio === dataFim é o caso normal de bloquear um único dia — só
    // rejeitar quando o início vem depois do fim de verdade.
    if (bloquearDataDto.dataInicio > bloquearDataDto.dataFim) {
      throw new BadRequestException(
        'A data de início deve ser anterior ou igual à data de fim',
      );
    }

    // Normalizar datas para considerar apenas o dia
    const dataInicio = new Date(bloquearDataDto.dataInicio);
    dataInicio.setHours(0, 0, 0, 0);

    const dataFim = new Date(bloquearDataDto.dataFim);
    dataFim.setHours(23, 59, 59, 999);

    // Verificar se já existe bloqueio para o período
    const bloqueioExistente = await this.disponibilidadeModel.findOne({
      data: {
        $gte: dataInicio,
        $lte: dataFim,
      },
    });

    if (bloqueioExistente) {
      throw new BadRequestException('Já existe um bloqueio para este período');
    }

    // Criar bloqueio para cada dia do período
    const bloqueios: Disponibilidade[] = [];
    const dataAtual = new Date(dataInicio);

    while (dataAtual <= dataFim) {
      const bloqueio = new this.disponibilidadeModel({
        data: new Date(dataAtual),
        disponibilidadeDiaria: bloquearDataDto.disponibilidadeDiaria ?? false,
        disponibilidadeBatismo: bloquearDataDto.disponibilidadeBatismo ?? false,
        chalesDisponiveis: bloquearDataDto.chalesDisponiveis ?? 0,
        observacoes: bloquearDataDto.observacoes,
      });

      await bloqueio.save();
      bloqueios.push(bloqueio);

      // Avançar para o próximo dia
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    this.logger.log(`Período bloqueado com sucesso: ${bloqueios.length} dias`);
    return bloqueios[0]; // Retorna o primeiro bloqueio como referência
  }

  async desbloquearData(id: string): Promise<void> {
    this.logger.log(`Desbloqueando data com ID: ${id}`);

    const resultado = await this.disponibilidadeModel
      .findByIdAndDelete(id)
      .exec();

    if (!resultado) {
      throw new NotFoundException('Bloqueio não encontrado');
    }

    this.logger.log('Data desbloqueada com sucesso');
  }

  async atualizarBloqueio(
    id: string,
    updateDisponibilidadeDto: UpdateDisponibilidadeDto,
  ): Promise<Disponibilidade> {
    this.logger.log(`Atualizando bloqueio com ID: ${id}`);

    const bloqueio = await this.disponibilidadeModel
      .findByIdAndUpdate(
        id,
        { $set: updateDisponibilidadeDto },
        { new: true, runValidators: true },
      )
      .exec();

    if (!bloqueio) {
      throw new NotFoundException('Bloqueio não encontrado');
    }

    this.logger.log('Bloqueio atualizado com sucesso');
    return bloqueio;
  }

  async verificarDisponibilidade(
    data: Date,
    tipo: string,
    quantidadeChales: number = 0,
  ): Promise<boolean> {
    return this.disponibilidadeModel.verificarDisponibilidade(
      data,
      tipo,
      quantidadeChales,
    );
  }

  async atualizarAposReserva(
    data: Date,
    tipo: string,
    quantidadeChales: number = 0,
    adicionar: boolean = false,
  ): Promise<void> {
    return this.disponibilidadeModel.atualizarAposReserva(
      data,
      tipo,
      quantidadeChales,
      adicionar,
    );
  }
}
