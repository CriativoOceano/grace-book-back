# Guia: Como Monitorar Webhooks do ASAAS

## 🔍 Formas de Verificar se sua App está Recebendo Webhooks

### **1. Logs do Backend (Principal)**

#### **Logs Automáticos Melhorados:**
```bash
# Terminal do backend
npm run start:dev

# Procure por estas mensagens com emojis:
🔔 [2025-01-20T10:30:00.000Z] WEBHOOK ASAAS RECEBIDO
📦 Payload completo: {...}
🔄 PROCESSANDO WEBHOOK ASAAS
✅ [2025-01-20T10:30:00.000Z] Webhook processado com sucesso
```

#### **Logs Específicos para Webhook:**
```typescript
// Implementado no webhook.controller.ts
this.logger.log(`🔔 [${timestamp}] WEBHOOK ASAAS RECEBIDO`);
this.logger.log(`📦 Payload completo: ${JSON.stringify(payload, null, 2)}`);
this.logger.log(`✅ [${timestamp}] Webhook processado com sucesso`);
```

### **2. Teste Manual de Webhook**

#### **Endpoint de Teste:**
```bash
# Teste local
curl -X POST http://localhost:3000/webhook/test \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CHECKOUT_PAID",
    "checkout": {
      "id": "test123",
      "status": "PAID",
      "value": 1000
    }
  }'
```

#### **Script de Teste Automatizado:**
```bash
# Execute o script de teste
node test-webhook.js
```

### **3. Monitoramento em Tempo Real**

#### **Comando para Filtrar Logs:**
```bash
# Filtrar apenas logs de webhook
npm run start:dev | grep -E "(🔔|📦|✅|❌|WEBHOOK)"

# Ou usar tail para arquivo de log
tail -f logs/app.log | grep -E "(WEBHOOK|webhook)"
```

### **4. Verificação no ASAAS**

#### **Painel do ASAAS:**
1. Acesse o painel do ASAAS
2. Vá em **Integrações > Webhooks**
3. Verifique o **Log de Webhooks**
4. Procure por status **200** (sucesso) ou **4xx/5xx** (erro)

#### **URLs de Webhook:**
- **Desenvolvimento**: `https://seu-ngrok-url.ngrok-free.app/webhook/asaas`
- **Produção**: `https://seu-dominio.com/webhook/asaas`

### **5. Teste com ngrok (Desenvolvimento)**

#### **Configurar ngrok:**
```bash
# Instalar ngrok
npm install -g ngrok

# Expor porta do backend
ngrok http 3000

# Usar URL do ngrok no ASAAS
# Exemplo: https://abc123.ngrok-free.app/webhook/asaas
```

#### **Testar Webhook com ngrok:**
```bash
# Teste direto no ngrok
curl -X POST https://abc123.ngrok-free.app/webhook/asaas \
  -H "Content-Type: application/json" \
  -d '{"event": "CHECKOUT_PAID", "checkout": {"id": "test"}}'
```

### **6. Logs de Debug Detalhados**

#### **Logs Implementados:**
```typescript
// WebhookController
🔔 [timestamp] WEBHOOK ASAAS RECEBIDO
📦 Payload completo: {...}
✅ [timestamp] Webhook processado com sucesso
❌ [timestamp] Erro ao processar webhook: {...}

// PagamentosService  
🔄 PROCESSANDO WEBHOOK ASAAS
📋 Payload: {...}
```

### **7. Verificação de Status de Pagamento**

#### **Logs de Atualização:**
```bash
# Procurar por atualizações de status
grep -E "(PAGO|PENDENTE|CANCELADO|EXPIRADO)" logs/app.log
```

### **8. Troubleshooting**

#### **Problemas Comuns:**

**1. Webhook não chega:**
```bash
# Verificar se o backend está rodando
curl http://localhost:3000/webhook/asaas

# Verificar logs de erro
grep -i "error\|erro" logs/app.log
```

**2. Webhook chega mas falha:**
```bash
# Verificar logs de processamento
grep -E "(❌|ERROR)" logs/app.log

# Verificar payload que causou erro
grep -A 5 -B 5 "Payload que causou erro" logs/app.log
```

**3. ASAAS retorna erro 404:**
```bash
# Verificar se a rota existe
curl -X POST http://localhost:3000/webhook/asaas

# Verificar se o módulo está carregado
grep -i "webhook" logs/app.log
```

### **9. Monitoramento Contínuo**

#### **Script de Monitoramento:**
```bash
#!/bin/bash
# monitor-webhooks.sh

while true; do
  echo "$(date): Verificando webhooks..."
  
  # Verificar se há novos webhooks nos últimos 5 minutos
  if tail -n 100 logs/app.log | grep -q "WEBHOOK ASAAS RECEBIDO"; then
    echo "✅ Webhook recebido recentemente"
  else
    echo "⚠️ Nenhum webhook recebido nos últimos 5 minutos"
  fi
  
  sleep 300 # 5 minutos
done
```

### **10. Alertas e Notificações**

#### **Configurar Alertas:**
```typescript
// Adicionar notificação em caso de erro
if (error) {
  this.logger.error(`❌ WEBHOOK FALHOU: ${error.message}`);
  
  // Enviar email de alerta
  await this.emailService.sendAlert({
    subject: 'Webhook ASAAS Falhou',
    message: `Erro: ${error.message}\nPayload: ${JSON.stringify(payload)}`
  });
}
```

## 🎯 Checklist de Verificação

- [ ] Backend rodando (`npm run start:dev`)
- [ ] Logs aparecendo no terminal
- [ ] URL do webhook configurada no ASAAS
- [ ] ngrok funcionando (desenvolvimento)
- [ ] Teste manual funcionando
- [ ] Script de teste executado
- [ ] Logs de webhook aparecendo
- [ ] Status de pagamento sendo atualizado

## 📊 Exemplo de Logs Esperados

```
🔔 [2025-01-20T10:30:00.000Z] WEBHOOK ASAAS RECEBIDO
📦 Payload completo: {
  "event": "CHECKOUT_PAID",
  "checkout": {
    "id": "checkout_123",
    "status": "PAID",
    "value": 1000
  }
}
🔄 PROCESSANDO WEBHOOK ASAAS
📋 Payload: {...}
✅ [2025-01-20T10:30:00.000Z] Webhook processado com sucesso
```

## 🚀 Próximos Passos

1. **Execute o script de teste**: `node test-webhook.js`
2. **Monitore os logs**: Procure pelos emojis 🔔📦✅
3. **Teste uma reserva real**: Faça uma reserva e acompanhe os logs
4. **Verifique no ASAAS**: Confirme que o webhook está sendo enviado
5. **Configure alertas**: Para receber notificações de falhas
