import exp from 'constants';

// Enum para tipos de reserva
export enum ModoPagamento {
  CARTAO = 'CREDIT_CARD',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
}

// Enum para status de pagamento
export enum StatusPagamento {
  PENDENTE = 'PENDENTE',
  PAGO = 'PAGO',
  CANCELADO = 'CANCELADO',
  REEMBOLSADO = 'REEMBOLSADO',
}

export enum TipoPagamento {
  AVISTA = 'AVISTA',
  PARCELADO = 'PARCELADO',
}
