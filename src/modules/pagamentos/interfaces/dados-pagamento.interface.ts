import { ModoPagamento, TipoPagamento } from '../pagamento.enums';

export interface IDadosPagamento {
  modoPagamento: ModoPagamento;
  tipoPagamento: TipoPagamento;
  valorTotal: number;
  parcelas?: number;
}
