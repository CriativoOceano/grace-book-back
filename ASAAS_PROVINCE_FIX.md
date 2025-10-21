# Correção: Mapeamento Correto de Campos para ASAAS

## Problema Identificado
O campo `province` estava recebendo o valor da UF (estado) quando deveria receber o valor do bairro.

## Correção Implementada

### **Mapeamento Correto para ASAAS:**

| Campo Frontend | Campo Backend | Campo ASAAS | Descrição |
|---|---|---|---|
| `enderecoHospede` | `dadosHospede.endereco` | `address` | Logradouro (rua, avenida) |
| `numeroHospede` | `dadosHospede.numero` | `addressNumber` | Número do endereço |
| `cepHospede` | `dadosHospede.cep` | `postalCode` | CEP (apenas números) |
| `bairroHospede` | `dadosHospede.bairro` | `province` | **Bairro** |
| `cidadeHospede` | `dadosHospede.cidade` | `city` | Cidade |
| `ufHospede` | `dadosHospede.uf` | `state` | Estado (UF) |

### **Código Corrigido:**

```typescript
// Bairro (province no ASAAS)
if (reserva.dadosHospede?.bairro) {
  customerData.province = reserva.dadosHospede.bairro;
  this.logger.log(`DEBUG: Adicionando province (bairro): ${reserva.dadosHospede.bairro}`);
}

// Cidade
if (reserva.dadosHospede?.cidade) {
  customerData.city = reserva.dadosHospede.cidade;
  this.logger.log(`DEBUG: Adicionando city: ${reserva.dadosHospede.cidade}`);
}

// Estado/UF (state no ASAAS)
if (reserva.dadosHospede?.uf) {
  customerData.state = reserva.dadosHospede.uf;
  this.logger.log(`DEBUG: Adicionando state (UF): ${reserva.dadosHospede.uf}`);
}
```

## Resultado Esperado

### **Antes (Incorreto):**
```json
{
  "customerData": {
    "address": "Quadra QR 114 Conjunto 4-A Comércio",
    "addressNumber": "114",
    "postalCode": "72302605",
    "province": "DF",  // ❌ UF em vez de bairro
    "city": "Brasília"
  }
}
```

### **Depois (Correto):**
```json
{
  "customerData": {
    "address": "Quadra QR 114 Conjunto 4-A Comércio",
    "addressNumber": "114",
    "postalCode": "72302605",
    "province": "Samambaia",  // ✅ Bairro correto
    "city": "Brasília",
    "state": "DF"  // ✅ UF no campo correto
  }
}
```

## Logs Esperados

```
DEBUG: Adicionando province (bairro): Samambaia
DEBUG: Adicionando city: Brasília
DEBUG: Adicionando state (UF): DF
```

## Status
✅ **Corrigido e testado**
✅ **Mapeamento correto implementado**
✅ **Logs de debug adicionados**
✅ **Sem erros de lint**
