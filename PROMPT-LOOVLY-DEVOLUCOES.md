# Correção na Edge Function ml-returns-sync

## Arquivo a alterar
`supabase/functions/ml-returns-sync/index.ts`

## Problema
A sincronização de devoluções do Mercado Livre está buscando apenas devoluções concluídas, ignorando as pendentes/em aberto.

---

## Correção 1: Alterar filtro da API (linha ~157-159)

**De:**
```typescript
const claimsRes = await fetch(
  `${ML_API_BASE}/post-purchase/v1/claims/search?seller_id=${conn.ml_user_id}&stage=return&limit=50`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
```

**Para:**
```typescript
const claimsRes = await fetch(
  `${ML_API_BASE}/post-purchase/v1/claims/search?seller_id=${conn.ml_user_id}&type=return&status=opened&limit=100`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
```

**Mudanças:**
- `stage=return` → `type=return` (filtra por tipo de claim)
- Adicionado `status=opened` (busca pendentes, não concluídas)
- `limit=50` → `limit=100` (aumentado para buscar mais)

---

## Correção 2: Expandir mapeamento de status (linha ~193-207)

**De:**
```typescript
const statusMap: Record<string, string> = {
  pending: "pendente_recebimento",
  shipped: "pendente_recebimento",
  delivered: "recebido",
  cancelled: "cancelada",
  failed: "cancelada",
  return_to_buyer: "cancelada",
};
```

**Para:**
```typescript
const statusMap: Record<string, string> = {
  // Statuses abertos/pendentes
  pending: "pendente_recebimento",
  opened: "pendente_recebimento",
  claim: "pendente_recebimento",
  dispute: "pendente_recebimento",
  recontact: "pendente_recebimento",
  // Statuses de envio/devolução
  shipped: "em_transito",
  return_in_transit: "em_transito",
  return_delivered: "recebido",
  // Statuses finalizados
  delivered: "recebido",
  received: "recebido",
  closed: "concluida",
  cancelled: "cancelada",
  failed: "cancelada",
  return_to_buyer: "cancelada",
  refunded: "reembolsada",
  not_delivered: "nao_recebida",
};
```

---

## Após fazer as alterações
1. Fazer deploy da função: `supabase functions deploy ml-returns-sync`
2. Testar com dryRun para verificar se busca as pendentes corretamente