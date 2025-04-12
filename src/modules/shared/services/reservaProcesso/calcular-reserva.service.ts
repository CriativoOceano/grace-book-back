import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { CONFIGURACOES_REPOSITORY } from 'src/modules/configuracoes/repositories/configuracaoes-repository.provider';
import { IConfiguracoesRepository } from 'src/modules/configuracoes/repositories/interfaces/reserva-repository.interface';
import { CreateReservaDto } from 'src/modules/reservas/dto/create-reserva.dto';

@Injectable()
export class CalculoReservaService {
  constructor(
    @Inject(CONFIGURACOES_REPOSITORY)
    private readonly configuracoesRepository: IConfiguracoesRepository,
  ) {}

  async getValorReserva(
    reservaData: CreateReservaDto
  ): Promise<number> {
    const config = await this.configuracoesRepository.findAll();
    let valorTotal = 0;
    const qtdDias = reservaData.quantidadeDiarias;

    switch (reservaData.tipo) {
      case 'diaria':
        if (reservaData.quantidadePessoas > config.qtdMaxPessoas) {
          throw new HttpException(
          `Quantidade de pessoas (${reservaData.quantidadePessoas}) excede o máximo permitido (${config.qtdMaxPessoas})`,
            HttpStatus.BAD_REQUEST
          );
        }
        for (const faixa of config.precoDiaria) {
          if (reservaData.quantidadePessoas <= faixa.maxPessoas) {
            valorTotal = qtdDias * faixa.valor;
            break;
          }
        }

        valorTotal += qtdDias * (reservaData.quantidadeChales || 0) * config.precoChale;
        break;

      case 'chale':
        valorTotal =
          qtdDias *
          ((reservaData.quantidadeChales || 0) * config.precoChale);
        break;

      case 'batismo':
        valorTotal = config.precoBatismo;
        break;

      default:
        throw new Error(`Tipo de reserva '${reservaData.tipo}' não reconhecido`);
    }

    return valorTotal;
  }
}
