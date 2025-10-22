# Grace Book Backend - Deploy no Render

## 🚀 Configuração para Render

### 📋 Checklist de Deploy:

#### 1. **Configurações do Render Service:**
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`
- **Node Version:** 20.x
- **Environment:** Node

#### 2. **Variáveis de Ambiente Necessárias:**
```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/grace-book

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# ASAAS Payment Gateway
ASAAS_API_KEY=your_asaas_api_key
ASAAS_ENVIRONMENT=production
ASAAS_BASE_URL=https://api.asaas.com/
ASAAS_WEBHOOK_SECRET=your_webhook_secret

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@sedecampestre.com

# Frontend URL (para CORS)
FRONTEND_URL=https://sedecampestre.netlify.app

# Server Port (Render define automaticamente)
PORT=10000
```

#### 3. **CORS Configuration:**
O backend precisa permitir requests do frontend em produção.

#### 4. **Database:**
- MongoDB Atlas (recomendado)
- Ou MongoDB local no Render

### 🔧 Arquivos de Configuração:

#### render.yaml (opcional)
```yaml
services:
  - type: web
    name: grace-book-backend
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start:prod
    envVars:
      - key: NODE_ENV
        value: production
```

### 📝 Passos para Deploy:

1. **Conectar repositório no Render**
2. **Configurar variáveis de ambiente**
3. **Configurar banco de dados**
4. **Deploy automático**
5. **Testar integração**

### 🔗 URLs após deploy:
- **Backend:** https://grace-book-backend.onrender.com
- **Frontend:** https://sedecampestre.netlify.app

### ⚠️ Importante:
- Render suspende serviços gratuitos após 15min de inatividade
- Para produção, considere upgrade para plano pago
- Configure health checks para manter serviço ativo
