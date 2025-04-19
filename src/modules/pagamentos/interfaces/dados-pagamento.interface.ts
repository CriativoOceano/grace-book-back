import { ModoPagamento, TipoPagamento } from '../pagamento.enums';

export interface IDadosPagamento {
  modoPagamento: ModoPagamento;
  tipoPagamento: TipoPagamento;
  valorTotal: number;
  valorDiaria: number;
  valorDiariaComChale: number;
  parcelas?: number;
}
