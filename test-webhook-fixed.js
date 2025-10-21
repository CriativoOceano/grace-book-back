#!/usr/bin/env node

/**
 * Script para testar webhook ASAAS com dados reais
 * 
 * Este script simula um webhook do ASAAS para testar se o sistema
 * consegue encontrar e processar pagamentos corretamente.
 */

const axios = require('axios');

// Configuração
const WEBHOOK_URL = 'https://e7154edcf9bd.ngrok-free.app/webhook/asaas';
const TEST_WEBHOOK_URL = 'https://e7154edcf9bd.ngrok-free.app/webhook/test';
const MIGRAR_DADOS_URL = 'https://e7154edcf9bd.ngrok-free.app/webhook/migrar-dados';

// Payload de teste baseado nos logs reais
const TEST_PAYLOAD = {
  "id": "evt_15e444ff9b9ab9ec29294aa1abe68025&10853997",
  "event": "PAYMENT_CONFIRMED",
  "dateCreated": "2025-10-20 02:31:02",
  "payment": {
    "object": "payment",
    "id": "pay_153tzg41ea6pa9j1",
    "dateCreated": "2025-10-20",
    "customer": "cus_000007140442",
    "checkoutSession": "3e5429a0-8c9c-4d97-b184-1b34b2c115c0",
    "paymentLink": null,
    "value": 1300,
    "netValue": 1260.64,
    "originalValue": null,
    "interestValue": null,
    "description": null,
    "billingType": "CREDIT_CARD",
    "confirmedDate": "2025-10-20",
    "creditCard": {
      "creditCardNumber": "4771",
      "creditCardBrand": "MASTERCARD",
      "creditCardToken": "0760c074-dc25-4246-82bc-96946bd15d27"
    },
    "pixTransaction": null,
    "status": "CONFIRMED",
    "dueDate": "2025-10-20",
    "originalDueDate": "2025-10-20",
    "paymentDate": null,
    "clientPaymentDate": "2025-10-20",
    "installmentNumber": null,
    "invoiceUrl": "https://sandbox.asaas.com/i/153tzg41ea6pa9j1",
    "invoiceNumber": "11690759",
    "externalReference": null,
    "deleted": false,
    "anticipated": false,
    "anticipable": true,
    "creditDate": "2025-11-21",
    "estimatedCreditDate": "2025-11-21",
    "transactionReceiptUrl": "https://sandbox.asaas.com/comprovantes/8178009850841883",
    "nossoNumero": null,
    "bankSlipUrl": null,
    "lastInvoiceViewedDate": null,
    "lastBankSlipViewedDate": null,
    "discount": {
      "value": 0,
      "limitDate": null,
      "dueDateLimitDays": 0,
      "type": "FIXED"
    },
    "fine": {
      "value": 0,
      "type": "FIXED"
    },
    "interest": {
      "value": 0,
      "type": "PERCENTAGE"
    },
    "postalService": false,
    "escrow": null,
    "refunds": null
  }
};

// Payload de teste com checkout session
const TEST_CHECKOUT_PAYLOAD = {
  "id": "evt_checkout_test",
  "event": "CHECKOUT_PAID",
  "dateCreated": "2025-10-20 02:31:02",
  "checkout": {
    "id": "3e5429a0-8c9c-4d97-b184-1b34b2c115c0",
    "status": "PAID",
    "value": 1300,
    "netValue": 1260.64,
    "paymentDate": "2025-10-20",
    "customer": "cus_000007140442",
    "billingType": "CREDIT_CARD"
  }
};

// Payload de teste para CHECKOUT_EXPIRED (deve cancelar a reserva)
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

// Payload de teste para PAYMENT_OVERDUE (deve cancelar a reserva)
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

async function testarWebhook(url, payload, nome) {
  console.log(`\n🧪 Testando ${nome}...`);
  console.log(`📡 URL: ${url}`);
  console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      timeout: 10000
    });
    
    console.log(`✅ Sucesso! Status: ${response.status}`);
    console.log(`📄 Resposta:`, JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log(`❌ Erro! Status: ${error.response?.status || 'N/A'}`);
    console.log(`📄 Resposta:`, JSON.stringify(error.response?.data || error.message, null, 2));
    return false;
  }
}

async function executarMigracao() {
  console.log(`\n🔄 Executando migração de dados...`);
  
  try {
    const response = await axios.post(MIGRAR_DADOS_URL, {}, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      timeout: 30000
    });
    
    console.log(`✅ Migração concluída! Status: ${response.status}`);
    console.log(`📄 Resposta:`, JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log(`❌ Erro na migração! Status: ${error.response?.status || 'N/A'}`);
    console.log(`📄 Resposta:`, JSON.stringify(error.response?.data || error.message, null, 2));
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando testes de webhook ASAAS...');
  console.log('=' .repeat(60));
  
  // 1. Executar migração de dados
  console.log('\n📋 PASSO 1: Migração de dados');
  const migracaoSucesso = await executarMigracao();
  
  if (!migracaoSucesso) {
    console.log('❌ Migração falhou, continuando com os testes...');
  }
  
  // 2. Testar webhook de payment
  console.log('\n📋 PASSO 2: Teste de webhook de payment');
  const paymentSucesso = await testarWebhook(
    TEST_WEBHOOK_URL, 
    TEST_PAYLOAD, 
    'Webhook de Payment'
  );
  
  // 3. Testar webhook de checkout
  console.log('\n📋 PASSO 3: Teste de webhook de checkout');
  const checkoutSucesso = await testarWebhook(
    TEST_WEBHOOK_URL, 
    TEST_CHECKOUT_PAYLOAD, 
    'Webhook de Checkout'
  );
  
  // 4. Testar webhook de checkout expirado (deve cancelar reserva)
  console.log('\n📋 PASSO 4: Teste de webhook de checkout expirado');
  const checkoutExpiredSucesso = await testarWebhook(
    TEST_WEBHOOK_URL, 
    TEST_CHECKOUT_EXPIRED_PAYLOAD, 
    'Webhook de Checkout Expirado'
  );
  
  // 5. Testar webhook de pagamento vencido (deve cancelar reserva)
  console.log('\n📋 PASSO 5: Teste de webhook de pagamento vencido');
  const paymentOverdueSucesso = await testarWebhook(
    TEST_WEBHOOK_URL, 
    TEST_PAYMENT_OVERDUE_PAYLOAD, 
    'Webhook de Pagamento Vencido'
  );
  
  // 6. Testar webhook real
  console.log('\n📋 PASSO 6: Teste de webhook real');
  const realSucesso = await testarWebhook(
    WEBHOOK_URL, 
    TEST_PAYLOAD, 
    'Webhook Real'
  );
  
  // Resumo dos resultados
  console.log('\n📊 RESUMO DOS TESTES');
  console.log('=' .repeat(60));
  console.log(`🔄 Migração de dados: ${migracaoSucesso ? '✅ Sucesso' : '❌ Falhou'}`);
  console.log(`💳 Webhook de Payment: ${paymentSucesso ? '✅ Sucesso' : '❌ Falhou'}`);
  console.log(`🛒 Webhook de Checkout: ${checkoutSucesso ? '✅ Sucesso' : '❌ Falhou'}`);
  console.log(`⏰ Webhook de Checkout Expirado: ${checkoutExpiredSucesso ? '✅ Sucesso' : '❌ Falhou'}`);
  console.log(`📅 Webhook de Pagamento Vencido: ${paymentOverdueSucesso ? '✅ Sucesso' : '❌ Falhou'}`);
  console.log(`🌐 Webhook Real: ${realSucesso ? '✅ Sucesso' : '❌ Falhou'}`);
  
  const totalSucessos = [migracaoSucesso, paymentSucesso, checkoutSucesso, checkoutExpiredSucesso, paymentOverdueSucesso, realSucesso].filter(Boolean).length;
  console.log(`\n🎯 Total de sucessos: ${totalSucessos}/6`);
  
  if (totalSucessos === 6) {
    console.log('🎉 Todos os testes passaram! Sistema funcionando corretamente.');
  } else {
    console.log('⚠️  Alguns testes falharam. Verifique os logs do servidor.');
  }
  
  console.log('\n📝 Próximos passos:');
  console.log('1. Verificar logs do servidor para detalhes');
  console.log('2. Confirmar se os pagamentos foram encontrados');
  console.log('3. Verificar se as reservas foram atualizadas');
  console.log('4. Testar com dados reais do ASAAS');
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testarWebhook,
  executarMigracao,
  TEST_PAYLOAD,
  TEST_CHECKOUT_PAYLOAD,
  TEST_CHECKOUT_EXPIRED_PAYLOAD,
  TEST_PAYMENT_OVERDUE_PAYLOAD
};
