# Correção de Webhooks de Vencimento - Grace Book

## Problema Identificado

O sistema não estava tratando corretamente os webhooks de vencimento do ASAAS, especificamente:

- `CHECKOUT_EXPIRED`: Quando um checkout expira (tempo limite excedido)
- `PAYMENT_OVERDUE`: Quando um pagamento vence (não foi processado no prazo)

Estes eventos estavam sendo tratados como `StatusPagamento.PENDENTE` ao invés de `StatusPagamento.CANCELADO`, o que não cancelava as reservas automaticamente.

## Correções Implementadas

### 1. Atualização do Tratamento de Webhooks

**Arquivo:** `src/modules/pagamentos/pagamentos.service.ts`

#### CHECKOUT_EXPIRED
```typescript
case 'CHECKOUT_EXPIRED':
  status = StatusPagamento.CANCELADO; // ✅ Cancelar quando checkout expira
  this.logger.warn(`🚨 CHECKOUT EXPIRADO - Cancelando reserva: ${checkoutId}`);
  break;
```

#### PAYMENT_OVERDUE
```typescript
case 'PAYMENT_OVERDUE':
  status = StatusPagamento.CANCELADO; // ✅ Cancelar quando pagamento vence
  this.logger.warn(`🚨 PAGAMENTO VENCIDO - Cancelando reserva: ${checkoutId}`);
  break;
```

### 2. Melhoria na Atualização de Status da Reserva

Adicionado sistema de motivos específicos para cancelamento:

```typescript
// Determinar motivo específico do cancelamento
let motivoCancelamento = 'Pagamento cancelado via ASAAS';

if (eventType === 'CHECKOUT_EXPIRED') {
  motivoCancelamento = 'Checkout expirado - Tempo limite excedido';
} else if (eventType === 'CHECKOUT_CANCELED') {
  motivoCancelamento = 'Checkout cancelado pelo usuário';
} else if (eventType === 'PAYMENT_OVERDUE') {
  motivoCancelamento = 'Pagamento vencido - Não foi processado no prazo';
} else if (eventType === 'PAYMENT_DELETED') {
  motivoCancelamento = 'Pagamento deletado no ASAAS';
} else if (eventType === 'PAYMENT_REFUNDED') {
  motivoCancelamento = 'Pagamento reembolsado';
}

await this.reservaRepository.atualizarStatus(
  reserva._id.toString(),
  StatusReserva.CANCELADA,
  `${motivoCancelamento} - Evento: ${eventType}`,
);
```

### 3. Validação de Segurança no Backend

**Arquivo:** `src/modules/reservas/reservar.service.ts`

Implementado método `validarERecalcularDadosFrontend()` que:

- Recalcula `quantidadeDiarias` baseado nas datas
- Valida limites de quantidade de pessoas (1-200)
- Valida limites de quantidade de chalés (0-4)
- Valida datas (não podem ser no passado)
- Valida se data fim é posterior à data início
- Registra alertas de segurança quando detecta manipulação

```typescript
private async validarERecalcularDadosFrontend(
  dadosFrontend: CreateReservaDto,
  userId: string
): Promise<{ dadosValidados: CreateReservaDto; alertasSeguranca: string[] }> {
  // ... validações de segurança
  return { dadosValidados, alertasSeguranca };
}
```

### 4. Script de Teste Atualizado

**Arquivo:** `test-webhook-fixed.js`

Adicionados novos payloads de teste:

```javascript
// Payload de teste para CHECKOUT_EXPIRED
const TEST_CHECKOUT_EXPIRED_PAYLOAD = {
  "id": "evt_checkout_expired_test",
  "event": "CHECKOUT_EXPIRED",
  "dateCreated": "2025-10-20 02:31:02",
  "checkout": {
    "id": "3e5429a0-8c9c-4d97-b184-1b34b2c115c0",
    "status": "EXPIRED",
    "value": 1300,
    "customer": "cus_000007140442",
    "billingType": "CREDIT_CARD"
  }
};

// Payload de teste para PAYMENT_OVERDUE
const TEST_PAYMENT_OVERDUE_PAYLOAD = {
  "id": "evt_payment_overdue_test",
  "event": "PAYMENT_OVERDUE",
  "dateCreated": "2025-10-20 02:31:02",
  "payment": {
    "id": "pay_153tzg41ea6pa9j1",
    "checkoutSession": "3e5429a0-8c9c-4d97-b184-1b34b2c115c0",
    "status": "OVERDUE",
    "value": 1300,
    "customer": "cus_000007140442",
    "billingType": "CREDIT_CARD",
    "paymentDate": null
  }
};
```

## Eventos de Webhook Tratados

| Evento | Status Anterior | Status Atual | Ação na Reserva |
|--------|----------------|--------------|-----------------|
| `CHECKOUT_PAID` | `PAGO` | `PAGO` | ✅ Confirmar |
| `CHECKOUT_EXPIRED` | `PENDENTE` | `CANCELADO` | 🚨 Cancelar |
| `CHECKOUT_CANCELED` | `CANCELADO` | `CANCELADO` | 🚨 Cancelar |
| `PAYMENT_RECEIVED` | `PAGO` | `PAGO` | ✅ Confirmar |
| `PAYMENT_CONFIRMED` | `PAGO` | `PAGO` | ✅ Confirmar |
| `PAYMENT_OVERDUE` | `PENDENTE` | `CANCELADO` | 🚨 Cancelar |
| `PAYMENT_DELETED` | `CANCELADO` | `CANCELADO` | 🚨 Cancelar |
| `PAYMENT_REFUNDED` | `CANCELADO` | `CANCELADO` | 🚨 Cancelar |

## Logs de Segurança

O sistema agora registra logs detalhados para auditoria:

```
🚨 ALERTA DE SEGURANÇA - Usuário: user123
📊 Dados originais: {"quantidadeDiarias": 5, "dataInicio": "2025-01-01", "dataFim": "2025-01-03"}
✅ Dados validados: {"quantidadeDiarias": 2, "dataInicio": "2025-01-01", "dataFim": "2025-01-03"}
⚠️ Alertas: Quantidade de diárias manipulada! Frontend enviou: 5, Calculado pelo backend: 2
```

## Como Testar

1. **Executar migração de dados:**
   ```bash
   node test-webhook-fixed.js
   ```

2. **Verificar logs do servidor** para confirmar que:
   - Webhooks de vencimento são recebidos
   - Reservas são canceladas automaticamente
   - Motivos específicos são registrados

3. **Verificar no painel administrativo** que:
   - Reservas com checkout expirado aparecem como "Cancelada"
   - Histórico mostra motivo específico do cancelamento

## Benefícios

✅ **Segurança:** Validação de dados do frontend no backend
✅ **Automação:** Cancelamento automático de reservas vencidas
✅ **Auditoria:** Logs detalhados para rastreamento
✅ **Transparência:** Motivos específicos de cancelamento
✅ **Confiabilidade:** Sistema robusto contra manipulação

## Próximos Passos

1. Monitorar logs em produção
2. Configurar alertas para tentativas de manipulação
3. Implementar notificações por email para cancelamentos
4. Considerar implementar grace period para pagamentos
