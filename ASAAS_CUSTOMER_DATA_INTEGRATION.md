# Integração de Dados do Cliente com ASAAS

## Visão Geral

Esta implementação permite que os dados pessoais preenchidos pelo usuário durante o processo de reserva sejam automaticamente enviados para o ASAAS, evitando que o usuário precise digitar novamente essas informações no checkout.

## Estrutura dos Dados

### Frontend (BookingComponent)
O frontend coleta os seguintes dados do hóspede:
- `nomeHospede`: Nome do hóspede
- `sobrenomeHospede`: Sobrenome do hóspede  
- `emailHospede`: Email do hóspede
- `cpfHospede`: CPF do hóspede (com formatação)
- `telefoneHospede`: Telefone do hóspede (com formatação)
- `observacoesHospede`: Observações especiais

### Backend (Reserva Schema)
Os dados são armazenados na reserva no campo `dadosHospede`:
```typescript
dadosHospede?: {
  nome: string;
  sobrenome: string;
  email: string;
  cpf: string;
  telefone: string;
  observacoes?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  bairro?: string;
  cidade?: string;
};
```

### ASAAS (customerData)
Os dados são enviados para o ASAAS no formato:
```typescript
customerData: {
  name: string;           // Nome completo (nome + sobrenome)
  cpfCnpj: string;       // CPF limpo (sem formatação)
  email: string;          // Email do hóspede
  phone: string;          // Telefone limpo (sem formatação)
  address?: string;       // Endereço (se disponível)
  addressNumber?: string; // Número (se disponível)
  complement?: string;    // Complemento (se disponível)
  postalCode?: string;   // CEP limpo (se disponível)
  province?: string;     // Bairro (se disponível)
  city?: string;         // Cidade (se disponível)
}
```

## Fluxo de Implementação

### 1. Frontend (booking.component.ts)
- Os dados do hóspede são coletados no formulário
- No método `finalizarReserva()`, os dados são estruturados em `dadosHospede`
- Os dados são enviados para o backend via `bookingService.createBooking()`

### 2. Backend (reservas.service.ts)
- O método `create()` recebe os dados do hóspede via `CreateReservaDto.dadosHospede`
- Os dados são armazenados na reserva no campo `dadosHospede`
- A reserva é criada com todos os dados necessários

### 3. Backend (pagamentos.service.ts)
- O método `buildCustomerData()` extrai os dados do hóspede da reserva
- Os dados são formatados conforme a estrutura esperada pelo ASAAS
- Campos vazios ou não preenchidos são omitidos do envio
- O método `buildDadosPagamento()` inclui o `customerData` na requisição para o ASAAS

## Características Importantes

### Limpeza de Dados
- CPF: Remove formatação (pontos, hífens) antes de enviar
- Telefone: Remove formatação (parênteses, espaços, hífens) antes de enviar
- CEP: Remove formatação antes de enviar

### Priorização de Dados
- Nome: Prioriza dados do hóspede, fallback para dados do usuário
- Email: Prioriza dados do hóspede, fallback para dados do usuário
- Outros campos: Usa apenas dados do hóspede se disponíveis

### Campos Opcionais
- Apenas campos preenchidos são incluídos no `customerData`
- Se nenhum campo estiver preenchido, `customerData` será `undefined`
- O ASAAS receberá apenas os dados disponíveis

## Exemplo de Uso

### Dados Preenchidos pelo Usuário:
```json
{
  "nomeHospede": "Ana Paula",
  "sobrenomeHospede": "Silva",
  "emailHospede": "ana@email.com",
  "cpfHospede": "123.456.789-00",
  "telefoneHospede": "(47) 98888-7777"
}
```

### Dados Enviados para o ASAAS:
```json
{
  "customerData": {
    "name": "Ana Paula Silva",
    "cpfCnpj": "12345678900",
    "email": "ana@email.com",
    "phone": "47988887777"
  }
}
```

## Benefícios

1. **Melhor UX**: Usuário não precisa digitar dados novamente no checkout
2. **Redução de Erros**: Menos chance de erros de digitação
3. **Processo Mais Rápido**: Checkout mais ágil
4. **Dados Consistentes**: Mesmos dados em todo o fluxo

## Testes

Para testar a implementação:

1. Faça uma reserva preenchendo todos os dados do hóspede
2. Verifique se os dados são enviados corretamente para o ASAAS
3. Confirme se o checkout do ASAAS já vem preenchido com os dados
4. Teste com dados parciais para verificar se campos vazios são omitidos

## Logs de Debug

O sistema inclui logs detalhados para debug:
- Dados da reserva sendo criada
- Dados do cliente sendo enviados para o ASAAS
- Resposta do ASAAS
- Erros detalhados em caso de falha

Verifique o arquivo `asaas-debug.log` para logs detalhados das operações.
