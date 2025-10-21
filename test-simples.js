#!/usr/bin/env node

/**
 * Script simples para testar apenas o recebimento de dados
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/reservas/publico';

const dadosSimples = {
  tipo: 'DIARIA',
  dataInicio: '2025-01-01T00:00:00.000Z',
  dataFim: '2025-01-03T00:00:00.000Z',
  quantidadePessoas: 1,
  dadosPagamento: {
    modoPagamento: 'CARTAO',
    parcelas: 1,
    valorTotal: 100
  },
  dadosHospede: {
    nome: 'Teste',
    sobrenome: 'Usuario',
    email: 'teste@email.com',
    cpf: '12345678900',
    telefone: '11999999999'
  }
};

async function testar() {
  console.log('🧪 Testando recebimento de dados...');
  console.log('📦 Dados:', JSON.stringify(dadosSimples, null, 2));
  
  try {
    const response = await axios.post(API_URL, dadosSimples, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('✅ Sucesso!');
    console.log('📄 Resposta:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Erro!');
    console.log('📄 Status:', error.response?.status);
    console.log('📄 Dados:', JSON.stringify(error.response?.data, null, 2));
  }
}

testar();
