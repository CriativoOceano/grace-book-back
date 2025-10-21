# Atualização da Integração de Dados do Cliente com ASAAS

## Novos Campos Implementados

### Frontend (BookingComponent)
Adicionados os seguintes campos de endereço no formulário:
- `enderecoHospede`: Endereço completo (rua, avenida, etc.)
- `numeroHospede`: Número do endereço
- `cepHospede`: CEP com formatação automática (00000-000)
- `bairroHospede`: Nome do bairro

### Backend (Schema e DTO)
Atualizados para incluir os novos campos:
```typescript
dadosHospede?: {
  nome: string;
  sobrenome: string;
  email: string;
  cpf: string;
  telefone: string;
  observacoes?: string;
  endereco?: string;      // NOVO
  numero?: string;        // NOVO
  cep?: string;           // NOVO
  bairro?: string;        // NOVO
};
```

### ASAAS (customerData)
Os novos campos são enviados conforme a estrutura esperada:
```typescript
customerData: {
  name: string;           // Nome completo (nome + sobrenome)
  cpfCnpj: string;       // CPF limpo (sem formatação)
  email: string;          // Email do hóspede
  phone: string;          // Telefone limpo (sem formatação)
  address: string;        // Endereço completo
  addressNumber: string;  // Número do endereço
  postalCode: string;     // CEP limpo (sem formatação)
  province: string;       // Bairro
}
```

## Implementação de Transações

### Problema Resolvido
Implementado sistema de transações para garantir que **nenhum dado seja salvo no banco se houver erro** em qualquer parte do fluxo de criação de reserva.

### Solução Implementada
1. **Método `executeWithTransaction`**: Wrapper que gerencia transações MongoDB
2. **Rollback Automático**: Se qualquer operação falhar, todas as mudanças são desfeitas
3. **Consistência de Dados**: Garante que reserva e pagamento sejam criados juntos ou nenhum seja criado

### Código Implementado
```typescript
private async executeWithTransaction<T>(
  operation: (session: any) => Promise<T>
): Promise<T> {
  const session = await this.reservaModel.db.startSession();
  
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } catch (error) {
    this.logger.error(`Erro na transação: ${error.message}`);
    throw error;
  } finally {
    await session.endSession();
  }
}
```

## Fluxo Atualizado

### 1. Frontend
- Usuário preenche todos os campos (incluindo endereço)
- Formatação automática de CEP (00000-000)
- Validação de campos obrigatórios
- Envio dos dados completos para o backend

### 2. Backend com Transação
- Inicia transação MongoDB
- Cria usuário (se necessário)
- Cria reserva com todos os dados
- Cria pagamento no ASAAS
- Se qualquer passo falhar: **ROLLBACK COMPLETO**
- Se tudo der certo: **COMMIT** de todas as operações

### 3. ASAAS
- Recebe dados completos do cliente
- Checkout pré-preenchido com todas as informações
- Usuário não precisa digitar dados novamente

## Exemplo de Dados Enviados

### Dados Preenchidos pelo Usuário:
```json
{
  "nomeHospede": "Ana Paula",
  "sobrenomeHospede": "Silva",
  "emailHospede": "ana@email.com",
  "cpfHospede": "123.456.789-00",
  "telefoneHospede": "(47) 98888-7777",
  "enderecoHospede": "Rua das Flores",
  "numeroHospede": "123",
  "cepHospede": "89000-000",
  "bairroHospede": "Centro"
}
```

### Dados Enviados para o ASAAS:
```json
{
  "customerData": {
    "name": "Ana Paula Silva",
    "cpfCnpj": "12345678900",
    "email": "ana@email.com",
    "phone": "47988887777",
    "address": "Rua das Flores",
    "addressNumber": "123",
    "postalCode": "89000000",
    "province": "Centro"
  }
}
```

## Benefícios da Implementação

### 1. **Dados Completos**
- Todos os campos de endereço são coletados e enviados
- Checkout do ASAAS totalmente preenchido

### 2. **Consistência de Dados**
- Transações garantem que dados sejam salvos completamente ou não sejam salvos
- Evita estados inconsistentes no banco de dados

### 3. **Melhor UX**
- Usuário não precisa digitar dados novamente
- Processo mais rápido e confiável

### 4. **Robustez**
- Sistema tolerante a falhas
- Rollback automático em caso de erro

## Testes Recomendados

### 1. **Teste de Sucesso**
- Preencher todos os campos
- Verificar se dados são salvos corretamente
- Confirmar checkout pré-preenchido

### 2. **Teste de Falha**
- Simular erro na criação do pagamento
- Verificar se nenhum dado é salvo no banco
- Confirmar rollback completo

### 3. **Teste de Dados Parciais**
- Preencher apenas alguns campos de endereço
- Verificar se apenas campos preenchidos são enviados
- Confirmar funcionamento correto

## Logs de Debug

O sistema inclui logs detalhados para monitoramento:
- Início e fim de transações
- Erros de transação com rollback
- Dados enviados para o ASAAS
- Status de criação de reserva e pagamento

Verifique os logs do sistema para acompanhar o fluxo completo.
