import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CONFIGURACOES_REPOSITORY } from 'src/modules/configuracoes/repositories/configuracaoes-repository.provider';
import { IConfiguracoesRepository } from 'src/modules/configuracoes/repositories/interfaces/reserva-repository.interface';
import { CotarReservaDto } from 'src/modules/reservas/DTO/cotar-reserva.dto';
import {
  PrecoSazonal,
  PrecoSazonalDocument,
} from 'src/schemas/preco-sazonal.schema';

interface AjusteSazonal {
  tipoAjuste: 'percentual' | 'fixo';
  valorAjuste: number;
}

@Injectable()
export class CalculoReservaService {
  constructor(
    @Inject(CONFIGURACOES_REPOSITORY)
    private readonly configuracoesRepository: IConfiguracoesRepository,
    @InjectModel(PrecoSazonal.name)
    private readonly precoSazonalModel: Model<PrecoSazonalDocument>,
  ) {}

  async getValorReserva(reservaData: CotarReservaDto): Promise<{
    valorDiaria: number;
    valorTotal: number;
    valorDiariaComChale?: number;
  }> {
    const config = await this.configuracoesRepository.findAll();
    const qtdDias =
      (await this.getQtdDias(reservaData.dataInicio, reservaData.dataFim)) ||
      reservaData.quantidadeDiarias;

    // Preço sazonal (feriados, fim de ano, datas comemorativas...) é
    // aplicado por dia dentro do período da reserva, não sobre o total —
    // uma diária de 3 noites que cruza só uma data de feriado deve cobrar
    // o ajuste apenas naquela noite, não nas outras duas.
    const dias = this.enumerarDias(new Date(reservaData.dataInicio), qtdDias);
    const regrasSazonais = await this.buscarRegrasSazonaisAtivas(
      dias[0],
      dias[dias.length - 1],
    );

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

        const quantidadeChales = reservaData.quantidadeChales || 0;
        let valorTotalDiarias = 0;
        let valorTotalChales = 0;

        for (const dia of dias) {
          const ajuste = this.encontrarAjusteParaData(regrasSazonais, dia);
          valorTotalDiarias += this.aplicarAjuste(valorDiariaBaseFaixa, ajuste);
          if (quantidadeChales > 0) {
            valorTotalChales +=
              this.aplicarAjuste(config.precoChale, ajuste) *
              quantidadeChales;
          }
        }

        const result: {
          valorDiaria: number;
          valorTotal: number;
          valorDiariaComChale?: number;
        } = {
          // Representa a diária do primeiro dia da estadia — se o período
          // cruzar um preço sazonal, dias diferentes podem ter valores
          // diferentes; valorTotal é sempre a soma correta dia a dia.
          valorDiaria: valorTotalDiarias / dias.length,
          valorTotal: valorTotalDiarias,
          valorDiariaComChale: null,
        };

        if (quantidadeChales > 0) {
          result.valorDiariaComChale =
            result.valorDiaria + valorTotalChales / dias.length;
          result.valorTotal = valorTotalDiarias + valorTotalChales;
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

        let valorTotal = 0;
        for (const dia of dias) {
          const ajuste = this.encontrarAjusteParaData(regrasSazonais, dia);
          valorTotal +=
            this.aplicarAjuste(config.precoChale, ajuste) *
            reservaData.quantidadeChales;
        }

        return {
          valorDiaria: valorTotal / dias.length,
          valorTotal,
          valorDiariaComChale: null,
        };
      }

      case 'batismo': {
        const ajuste = this.encontrarAjusteParaData(regrasSazonais, dias[0]);
        const valorDiaria = this.aplicarAjuste(config.precoBatismo, ajuste);

        return {
          valorDiaria,
          valorTotal: valorDiaria,
          valorDiariaComChale: null,
        };
      }

      default:
        throw new Error(
          `Tipo de reserva '${reservaData.tipo}' não reconhecido`,
        );
    }
  }

  async getQtdDias(dataInicio: Date, dataFim: Date): Promise<number> {
    if (!dataFim) return 1;

    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diferencaMS = fim.getTime() - inicio.getTime();
    const diferencaDias = Math.max(
      1,
      Math.ceil(diferencaMS / (1000 * 60 * 60 * 24)),
    );
    return diferencaDias;
  }

  private enumerarDias(dataInicio: Date, qtdDias: number): Date[] {
    const dias: Date[] = [];
    for (let i = 0; i < qtdDias; i++) {
      const dia = new Date(dataInicio);
      dia.setDate(dia.getDate() + i);
      dias.push(dia);
    }
    return dias;
  }

  private async buscarRegrasSazonaisAtivas(
    primeiroDia: Date,
    ultimoDia: Date,
  ): Promise<PrecoSazonal[]> {
    return this.precoSazonalModel
      .find({
        ativo: true,
        dataInicio: { $lte: ultimoDia },
        dataFim: { $gte: primeiroDia },
      })
      .lean();
  }

  private encontrarAjusteParaData(
    regras: PrecoSazonal[],
    data: Date,
  ): AjusteSazonal | null {
    const diaAlvo = this.normalizarData(data);
    const regra = regras.find((r) => {
      return (
        diaAlvo >= this.normalizarData(r.dataInicio) &&
        diaAlvo <= this.normalizarData(r.dataFim)
      );
    });
    if (!regra) return null;
    return { tipoAjuste: regra.tipoAjuste, valorAjuste: regra.valorAjuste };
  }

  private normalizarData(data: Date): string {
    return new Date(data).toISOString().split('T')[0];
  }

  private aplicarAjuste(
    valorBase: number,
    ajuste: AjusteSazonal | null,
  ): number {
    if (!ajuste) return valorBase;
    if (ajuste.tipoAjuste === 'percentual') {
      return valorBase * (1 + ajuste.valorAjuste / 100);
    }
    return valorBase + ajuste.valorAjuste;
  }
}
