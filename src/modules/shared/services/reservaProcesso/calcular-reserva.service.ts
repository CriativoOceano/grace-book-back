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
    reservaData: CreateReservaDto,
  ): Promise<{ valorDiaria: number; valorTotal: number; valorDiariaComChale?: number }> {
    const config = await this.configuracoesRepository.findAll();
    let qtdDias =
      (await this.getQtdDias(reservaData.dataInicio, reservaData.dataFim)) ||
      reservaData.quantidadeDiarias;

    switch (reservaData.tipo) {
      case 'diaria': {
        if (reservaData.quantidadePessoas > config.qtdMaxPessoas) {
          throw new HttpException(
            `Quantidade de pessoas (${reservaData.quantidadePessoas}) excede o máximo permitido (${config.qtdMaxPessoas})`,
            HttpStatus.BAD_REQUEST,
          );
        }

        let valorDiariaBaseFaixa = 0;
        for (const faixa of config.precoDiaria) {
          if (reservaData.quantidadePessoas <= faixa.maxPessoas) {
            valorDiariaBaseFaixa = faixa.valor;
            break;
          }
        }

        const valorDiariaChales =
          (reservaData.quantidadeChales || 0) * config.precoChale;

        const result: {
          valorDiaria: number;
          valorTotal: number;
          valorDiariaComChale?: number;
        } = {
          valorDiaria: valorDiariaBaseFaixa,
          valorTotal: valorDiariaBaseFaixa * qtdDias,
          valorDiariaComChale: null
        };

        if (reservaData.quantidadeChales && reservaData.quantidadeChales > 0) {
          result.valorDiariaComChale = valorDiariaBaseFaixa + valorDiariaChales;
          result.valorTotal = result.valorDiariaComChale * qtdDias;
        }

        return result;
      }

      case 'chale': {
        if (
          !reservaData.quantidadeChales ||
          reservaData.quantidadeChales <= 0
        ) {
          throw new HttpException(
            'A quantidade de chalés deve ser maior que zero',
            HttpStatus.BAD_REQUEST,
          );
        }

        const valorDiaria = reservaData.quantidadeChales * config.precoChale;

        return {
          valorDiaria,
          valorTotal: valorDiaria * qtdDias,
          valorDiariaComChale: null
        };
      }

      case 'batismo': {
        const valorDiaria = config.precoBatismo;

        return {
          valorDiaria,
          valorTotal: valorDiaria,
          valorDiariaComChale: null
        };
      }

      default:
        throw new Error(
          `Tipo de reserva '${reservaData.tipo}' não reconhecido`,
        );
    }
  }

  async getQtdDias(dataInicio: Date, dataFim: Date): Promise<number> {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diferencaMS = fim.getTime() - inicio.getTime();
    const diferencaDias = Math.max(
      1,
      Math.ceil(diferencaMS / (1000 * 60 * 60 * 24)),
    );
    return diferencaDias;
  }
}
