#!/usr/bin/env node

/**
 * Script para testar webhooks do ASAAS
 * Uso: node test-webhook.js
 */

const axios = require('axios');

// Configurações
const WEBHOOK_URL = 'http://localhost:3000/webhook/test'; // URL do seu backend
const ASAAS_WEBHOOK_URL = 'http://localhost:3000/webhook/asaas'; // URL real do webhook

// Payload de teste para checkout pago
const TEST_PAYLOAD_CHECKOUT_PAID = {
  event: 'CHECKOUT_PAID',
  checkout: {
    id: Math.random().toString(36).substring(2, 15),
    status: 'PAID',
    value: 1000,
    netValue: 950,
    originalValue: 1000,
    interestValue: 0,
    description: 'Diária',
    billingType: 'CREDIT_CARD',
    pixTransaction: null,
    creditCard: {
      creditCardNumber: '**** **** **** 1234',
      creditCardBrand: 'VISA',
      creditCardToken: 'abc123'
    },
    status: 'PAID',
    pixTransaction: null,
    confirmedDate: new Date().toISOString(),
    dateCreated: new Date().toISOString()
  }
};

// Payload de teste para checkout expirado
const TEST_PAYLOAD_CHECKOUT_EXPIRED = {
  event: 'CHECKOUT_EXPIRED',
  checkout: {
    id: Math.random().toString(36).substring(2, 15),
    status: 'EXPIRED',
    value: 1000,
    description: 'Diária',
    billingType: 'PIX',
    dateCreated: new Date().toISOString()
  }
};

async function testarWebhook(payload, tipo) {
  try {
    console.log(`\n🧪 Testando webhook: ${tipo}`);
    console.log(`📦 Payload: ${JSON.stringify(payload, null, 2)}`);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ Resposta: ${JSON.stringify(response.data, null, 2)}`);
    console.log(`📊 Status: ${response.status}`);
    
  } catch (error) {
    console.error(`❌ Erro: ${error.message}`);
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📦 Resposta: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function testarWebhookReal(payload, tipo) {
  try {
    console.log(`\n🔔 Testando webhook real ASAAS: ${tipo}`);
    console.log(`📦 Payload: ${JSON.stringify(payload, null, 2)}`);
    
    const response = await axios.post(ASAAS_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ Resposta: ${JSON.stringify(response.data, null, 2)}`);
    console.log(`📊 Status: ${response.status}`);
    
  } catch (error) {
    console.error(`❌ Erro: ${error.message}`);
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📦 Resposta: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function main() {
  console.log('🚀 Iniciando testes de webhook...');
  console.log(`🌐 URL de teste: ${WEBHOOK_URL}`);
  console.log(`🌐 URL real ASAAS: ${ASAAS_WEBHOOK_URL}`);
  
  // Teste 1: Checkout pago
  await testarWebhook(TEST_PAYLOAD_CHECKOUT_PAID, 'CHECKOUT_PAID');
  
  // Aguardar 2 segundos
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Teste 2: Checkout expirado
  await testarWebhook(TEST_PAYLOAD_CHECKOUT_EXPIRED, 'CHECKOUT_EXPIRED');
  
  // Aguardar 2 segundos
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Teste 3: Webhook real ASAAS
  await testarWebhookReal(TEST_PAYLOAD_CHECKOUT_PAID, 'CHECKOUT_PAID (Real)');
  
  console.log('\n✅ Testes concluídos!');
  console.log('\n📋 Verifique os logs do seu backend para ver se os webhooks foram processados.');
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testarWebhook, testarWebhookReal };