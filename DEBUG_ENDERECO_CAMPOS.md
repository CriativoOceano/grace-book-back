# Teste dos Campos de Endereço - Debug

## Problema Identificado
Os campos de endereço não estão sendo enviados para o ASAAS conforme o log:
```json
{
  "customerData": {
    "name": "Anderson Alves",
    "cpfCnpj": "04750090107", 
    "email": "andersonalves.tech@gmail.com",
    "phone": "61981708537"
  }
}
```

## Correções Implementadas

### 1. Frontend (booking.component.ts)
✅ **CORRIGIDO**: Adicionados os campos de endereço no método `getCustomerData()`:
```typescript
enderecoHospede: formValue.enderecoHospede,
numeroHospede: formValue.numeroHospede,
cepHospede: formValue.cepHospede,
bairroHospede: formValue.bairroHospede,
```

### 2. Backend (pagamentos.service.ts)
✅ **CORRIGIDO**: Adicionados logs de debug no método `buildCustomerData()`:
```typescript
this.logger.log(`DEBUG: Construindo customerData para reserva ${reserva.codigo}`);
this.logger.log(`DEBUG: Dados do hóspede: ${JSON.stringify(reserva.dadosHospede)}`);
this.logger.log(`DEBUG: CustomerData construído: ${JSON.stringify(customerData)}`);
```

## Como Testar

### 1. Preencher Formulário Completo
- Nome: Anderson Alves
- Sobrenome: Silva
- Email: andersonalves.tech@gmail.com
- CPF: 047.500.901-07
- Telefone: (61) 98170-8537
- **Endereço**: Rua das Flores
- **Número**: 123
- **CEP**: 89000-000
- **Bairro**: Centro

### 2. Verificar Logs do Backend
Após fazer uma reserva, verificar os logs para:
```
DEBUG: Construindo customerData para reserva RES1001
DEBUG: Dados do hóspede: {"nome":"Anderson","sobrenome":"Alves","email":"andersonalves.tech@gmail.com","cpf":"047.500.901-07","telefone":"(61) 98170-8537","endereco":"Rua das Flores","numero":"123","cep":"89000-000","bairro":"Centro"}
DEBUG: CustomerData construído: {"name":"Anderson Alves","cpfCnpj":"04750090107","email":"andersonalves.tech@gmail.com","phone":"61981708537","address":"Rua das Flores","addressNumber":"123","postalCode":"89000000","province":"Centro"}
```

### 3. Verificar Log do ASAAS
O log de criação da cobrança deve mostrar:
```json
{
  "customerData": {
    "name": "Anderson Alves",
    "cpfCnpj": "04750090107",
    "email": "andersonalves.tech@gmail.com", 
    "phone": "61981708537",
    "address": "Rua das Flores",
    "addressNumber": "123",
    "postalCode": "89000000",
    "province": "Centro"
  }
}
```

## Próximos Passos

1. **Testar com dados completos**: Preencher todos os campos de endereço
2. **Verificar logs**: Confirmar que os dados estão sendo passados
3. **Testar checkout**: Verificar se o ASAAS recebe os dados completos
4. **Testar com dados parciais**: Verificar se apenas campos preenchidos são enviados

## Possíveis Causas se Ainda Não Funcionar

1. **Cache do navegador**: Limpar cache e testar novamente
2. **Dados não salvos**: Verificar se os dados estão sendo salvos na reserva
3. **Problema no banco**: Verificar se os dados estão sendo persistidos corretamente

## Comando para Testar
```bash
# No backend, verificar logs em tempo real
tail -f asaas-debug.log

# Ou verificar logs do NestJS
npm run start:dev
```
