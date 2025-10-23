import exp from 'constants';

// Enum para tipos de reserva
export enum ModoPagamento {
  CARTAO = 'CARTAO', // Mudado para corresponder ao frontend
  CREDIT_CARD = 'CREDIT_CARD',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
}

// Enum para status de pagamento
export enum StatusPagamento {
  PENDENTE = 'PENDENTE',
  PAGO = 'PAGO',
  CONFIRMADO = 'CONFIRMADO',
  RECEBIDO = 'RECEBIDO',
  CANCELADO = 'CANCELADO',
  REEMBOLSADO = 'REEMBOLSADO',
  ESTORNADO = 'ESTORNADO',
}

export enum TipoPagamento {
  AVISTA = 'AVISTA',
  PARCELADO = 'PARCELADO',
}
