#!/bin/bash

# Script para testar build do backend antes do deploy no Render

echo "🔧 Testando build do backend..."

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Executar lint
echo "🔍 Executando lint..."
npm run lint

# Executar build
echo "🏗️ Executando build..."
npm run build

# Verificar se build foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Build executado com sucesso!"
    echo "🚀 Pronto para deploy no Render"
else
    echo "❌ Build falhou!"
    echo "🔧 Verifique os erros acima"
    exit 1
fi
