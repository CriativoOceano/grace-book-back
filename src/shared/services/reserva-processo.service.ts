import { Injectable, Inject } from '@nestjs/common';
import { IPagamentoRepository } from 'src/modules/pagamentos/repositories/interfaces/pagamento-repository.interface';
import { CreateReservaDto } from 'src/modules/reservas/dto/create-reserva.dto';
import { IReservaRepository } from 'src/modules/reservas/repositories/interfaces/reserva-repository.interface';
import { StatusPagamento } from 'src/schemas/reserva.schema';
import { PAGAMENTO_REPOSITORY } from 'src/modules/pagamentos/repositories/pagamento-repository.provider';
import { RESERVA_REPOSITORY } from 'src/modules/reservas/repositories/reserva-repository.provider';
import { PagamentosService } from 'src/modules/pagamentos/pagamentos.service';

@Injectable()
export class ReservaProcessoService {
  constructor(
    @Inject(RESERVA_REPOSITORY)
    private readonly reservaRepository: IReservaRepository,

    @Inject(PAGAMENTO_REPOSITORY)
    private readonly pagamentoRepository: IPagamentoRepository,

    private readonly pagamentoService: PagamentosService,
  ) {}

  async processarNovaReserva(dadosReserva: CreateReservaDto) {
    const reserva = await this.reservaRepository.createReserva(dadosReserva);

    const pagamento = await this.pagamentoService.criarCobranca(reserva['_id'].toString());

    await this.reservaRepository.updateReserva(reserva['_id'].toString(), { pagamento: pagamento });

    return { reserva, pagamento };
  }

  async processarCancelamentoReserva(reservaId: string): Promise<void> {
    // 1. Buscar pagamentos associados
    const pagamentos =
      await this.pagamentoRepository.findByReservaId(reservaId);

    // 2. Cancelar pagamentos
    for (const pagamento of pagamentos) {
      await this.pagamentoRepository.updatePagamento(
        pagamento.reservaId.toString(),
        {
          status: StatusPagamento.CANCELADO,
        },
      );
    }

    // 3. Cancelar reserva
    // await this.reservaRepository.updateReserva(reservaId, {
    //   statusPagamento: StatusPagamento.CANCELADO
    // });
  }
}
