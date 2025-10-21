#!/usr/bin/env node

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Configuração do MongoDB (ajuste conforme necessário)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/grace-book';

// Schema simplificado para Configuracao
const configuracaoSchema = new mongoose.Schema({
  adminAccessCode: String
}, { collection: 'configuracoes' });

const Configuracao = mongoose.model('Configuracao', configuracaoSchema);

async function updateAdminCode(newCode) {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // Gerar hash do novo código
    const saltRounds = 10;
    const hashedCode = await bcrypt.hash(newCode, saltRounds);
    console.log(`🔐 Hash gerado para o código: ${hashedCode}`);

    // Atualizar no banco de dados
    const result = await Configuracao.updateOne(
      {}, // Filtro vazio para atualizar o primeiro documento
      { $set: { adminAccessCode: hashedCode } }
    );

    if (result.matchedCount === 0) {
      console.log('❌ Nenhuma configuração encontrada. Criando nova configuração...');
      
      // Criar nova configuração se não existir
      const newConfig = new Configuracao({
        adminAccessCode: hashedCode
      });
      await newConfig.save();
      console.log('✅ Nova configuração criada com sucesso!');
    } else {
      console.log('✅ Código admin atualizado com sucesso!');
    }

    console.log(`\n📋 Resumo:`);
    console.log(`   Código: ${newCode}`);
    console.log(`   Hash: ${hashedCode}`);
    console.log(`   Documentos atualizados: ${result.modifiedCount}`);

  } catch (error) {
    console.error('❌ Erro ao atualizar código admin:', error);
  } finally {
    // Fechar conexão
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }
}

// Verificar argumentos
const newCode = process.argv[2];

if (!newCode) {
  console.log('❌ Uso: node update-admin-code.js <NOVO_CODIGO>');
  console.log('📝 Exemplo: node update-admin-code.js meuNovoCodigo123');
  process.exit(1);
}

if (newCode.length < 6) {
  console.log('⚠️  Aviso: Recomenda-se usar códigos com pelo menos 6 caracteres');
}

console.log(`🔄 Atualizando código admin para: ${newCode}`);
updateAdminCode(newCode);
