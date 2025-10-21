# Configuração do Webhook ASAAS

## Rota do Webhook
- **URL**: `POST /webhook/asaas`
- **Controller**: `WebhookController`
- **Método**: `receberWebhookAsaas()`

## Configuração no ASAAS
No painel do ASAAS, configure o webhook para apontar para:
```
https://seu-dominio.com/webhook/asaas
```

## Chave de Idempotência
- **Tipo**: UUID v4
- **Geração**: Automática para cada tentativa de cobrança
- **Vantagem**: Evita conflitos e garante unicidade global

## Eventos Suportados

### Checkout Events
- `CHECKOUT_PAID` → Status: PAGO
- `CHECKOUT_EXPIRED` → Status: PENDENTE
- `CHECKOUT_CANCELED` → Status: CANCELADO

### Payment Events
- `PAYMENT_RECEIVED` → Status: PAGO
- `PAYMENT_CONFIRMED` → Status: PAGO
- `PAYMENT_OVERDUE` → Status: PENDENTE
- `PAYMENT_DELETED` → Status: CANCELADO
- `PAYMENT_REFUNDED` → Status: CANCELADO

## Ações Automáticas
1. Atualiza status do pagamento no banco
2. Atualiza status da reserva (CONFIRMADA/CANCELADA)
3. Envia email de notificação
4. Registra logs detalhados

## Teste
Execute o script de teste:
```bash
node test-webhook.js
```

## Logs
Todos os webhooks são logados com detalhes completos para debugging.
