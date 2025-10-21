#!/usr/bin/env node

/**
 * Script para testar o endpoint de reserva pública
 * 
 * Este script simula uma requisição do frontend para o backend
 * para verificar se os dados estão sendo enviados corretamente.
 */

const axios = require('axios');

// Configuração
const API_URL = 'http://localhost:3000/reservas/publico';

// Dados de teste simulando o frontend
const TEST_DATA = {
  tipo: 'DIARIA',
  dataInicio: '2025-01-01T00:00:00.000Z',
  dataFim: '2025-01-03T00:00:00.000Z',
  quantidadePessoas: 2,
  quantidadeChales: 1,
  quantidadeDiarias: 2,
  observacoes: 'Teste de reserva',
  dadosPagamento: {
    modoPagamento: 'CARTAO',
    parcelas: 1,
    valorTotal: 1300
  },
  dadosHospede: {
    nome: 'João',
    sobrenome: 'Silva',
    email: 'joao.silva@email.com',
    cpf: '123.456.789-00',
    telefone: '(11) 99999-9999',
    observacoes: 'Teste de hóspede',
    endereco: 'Rua das Flores, 123',
    numero: '123',
    cep: '01234-567',
    bairro: 'Centro',
    cidade: 'São Paulo',
    uf: 'SP'
  },
  valorCalculado: 1300,
  usuarioNome: 'João Silva',
  usuarioEmail: 'joao.silva@email.com'
};

async function testarReservaPublica() {
  console.log('🧪 Testando endpoint de reserva pública...');
  console.log('📡 URL:', API_URL);
  console.log('📦 Dados enviados:', JSON.stringify(TEST_DATA, null, 2));
  
  try {
    const response = await axios.post(API_URL, TEST_DATA, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ Sucesso! Status:', response.status);
    console.log('📄 Resposta:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ Erro! Status:', error.response?.status || 'N/A');
    console.log('📄 Resposta:', JSON.stringify(error.response?.data || error.message, null, 2));
    
    if (error.response?.data?.message) {
      console.log('🔍 Mensagem de erro:', error.response.data.message);
    }
    
    return false;
  }
}

async function testarDadosInvalidos() {
  console.log('\n🧪 Testando com dados inválidos (sem email e CPF)...');
  
  const dadosInvalidos = {
    ...TEST_DATA,
    dadosHospede: {
      nome: 'João',
      sobrenome: 'Silva',
      // email: 'joao.silva@email.com', // ❌ Sem email
      // cpf: '123.456.789-00',        // ❌ Sem CPF
      telefone: '(11) 99999-9999'
    }
  };
  
  try {
    const response = await axios.post(API_URL, dadosInvalidos, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('❌ ERRO: Deveria ter falhado mas retornou sucesso!');
    console.log('📄 Resposta:', JSON.stringify(response.data, null, 2));
    return false;
  } catch (error) {
    console.log('✅ Correto! Falhou como esperado');
    console.log('📄 Erro:', JSON.stringify(error.response?.data || error.message, null, 2));
    return true;
  }
}

async function main() {
  console.log('🚀 Iniciando testes de reserva pública...');
  console.log('=' .repeat(60));
  
  // Teste 1: Dados válidos
  console.log('\n📋 TESTE 1: Dados válidos');
  const teste1Sucesso = await testarReservaPublica();
  
  // Teste 2: Dados inválidos
  console.log('\n📋 TESTE 2: Dados inválidos');
  const teste2Sucesso = await testarDadosInvalidos();
  
  // Resumo
  console.log('\n📊 RESUMO DOS TESTES');
  console.log('=' .repeat(60));
  console.log(`✅ Teste com dados válidos: ${teste1Sucesso ? 'PASSOU' : 'FALHOU'}`);
  console.log(`✅ Teste com dados inválidos: ${teste2Sucesso ? 'PASSOU' : 'FALHOU'}`);
  
  if (teste1Sucesso && teste2Sucesso) {
    console.log('\n🎉 Todos os testes passaram!');
    console.log('📝 Próximos passos:');
    console.log('1. Verificar logs do servidor para detalhes');
    console.log('2. Confirmar se a reserva foi criada corretamente');
    console.log('3. Verificar se o usuário foi criado automaticamente');
  } else {
    console.log('\n⚠️  Alguns testes falharam.');
    console.log('📝 Verifique:');
    console.log('1. Se o backend está rodando na porta 3000');
    console.log('2. Se os logs do servidor mostram os dados recebidos');
    console.log('3. Se há erros de validação ou schema');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testarReservaPublica,
  testarDadosInvalidos,
  TEST_DATA
};
