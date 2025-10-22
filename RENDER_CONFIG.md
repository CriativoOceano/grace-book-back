# Grace Book Backend - Render Configuration

## 🚀 Deploy no Render

### 📋 Configurações do Service:

**Tipo:** Web Service  
**Environment:** Node  
**Build Command:** `npm install && npm run build`  
**Start Command:** `npm run start:prod`  
**Node Version:** 20  

### 🔧 Variáveis de Ambiente:

```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/grace-book

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_minimum_32_chars
JWT_EXPIRES_IN=24h

# ASAAS Payment Gateway
ASAAS_API_KEY=your_asaas_production_api_key
ASAAS_ENVIRONMENT=production
ASAAS_BASE_URL=https://api.asaas.com/
ASAAS_WEBHOOK_SECRET=your_webhook_secret_key

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=noreply@sedecampestre.com

# Frontend URL (para CORS)
FRONTEND_URL=https://sedecampestre.netlify.app

# Server Configuration
NODE_ENV=production
PORT=10000
```

### 🗄️ Database Setup:

**Opção 1: MongoDB Atlas (Recomendado)**
1. Criar cluster no MongoDB Atlas
2. Configurar acesso de rede (0.0.0.0/0)
3. Criar usuário com senha
4. Obter connection string

**Opção 2: MongoDB no Render**
1. Criar MongoDB service no Render
2. Usar connection string interna

### 🔗 URLs após Deploy:

- **Backend:** `https://grace-book-backend.onrender.com`
- **Frontend:** `https://sedecampestre.netlify.app`

### ⚠️ Importante:

1. **Serviços Gratuitos:** Suspensos após 15min de inatividade
2. **Cold Start:** Primeira requisição pode demorar ~30s
3. **Health Checks:** Configure para manter serviço ativo
4. **Logs:** Monitore logs para debug

### 🧪 Teste de Deploy:

```bash
# Testar se backend está funcionando
curl https://grace-book-backend.onrender.com/health

# Testar CORS
curl -H "Origin: https://sedecampestre.netlify.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://grace-book-backend.onrender.com/
```

### 📝 Próximos Passos:

1. ✅ Conectar repositório no Render
2. ✅ Configurar variáveis de ambiente
3. ✅ Deploy automático
4. ✅ Testar integração frontend-backend
5. ✅ Configurar domínio customizado (opcional)
