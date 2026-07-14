# STOVIX — Relatório de handoff (para trocar de PC)

## 1. O que é o STOVIX
WMS (Warehouse Management System) pessoal do **Eduar** para gerenciar
**operações Full do Mercado Livre** em `C:\Users\eduar\Desktop\STOVIX`.
- **Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn-ui
- **Backend:** Supabase (Edge Functions em Deno, pg_cron, Vault p/ segredos, RLS)
- **Deploy/edição:** **Lovable** (chat-based) — você não mexe no backend direto; eu gero prompts `PROMPT_*.md` que você cola no Lovable, e você roda SQL no **SQL Editor do Supabase**.
- **Conta ML de teste:** seller **1075018916** (tem Full). Outra conta: 228868464 (só drop_off).

> ⚠️ O backend **NÃO** roda na sua conta pessoal do Supabase — roda no **Lovable Cloud** (projeto `cjmoecedmsguxewyhdie`). Toda Edge Function nova/alterada precisa de **redeploy via Lovable**. Secrets já estão configurados.

## 2. Como voltar a trabalhar comigo (Claude/Claude Code)
1. **Instalar Claude Code** no novo PC (mesmo plano).
2. **Copiar a pasta do projeto** inteira para `C:\Users\eduar\Desktop\STOVIX` (manter o caminho é importante — o `package.json`, node_modules e `.git` precisam estar lá; sem node_modules rode `npm install` no novo PC).
3. **Abrir a pasta** no Claude Code (`code C:\Users\eduar\Desktop\STOVIX` ou arrastar pro VSCode).
4. **Contexto inicial da sessão:** chegar com um resumo do estado atual (este doc + último que estava fazendo). Sem isso, eu começo do zero.
5. **Regras de ouro** (do `CLAUDE.md` global): usar TodoWrite para tarefas com 3+ passos, confirmar antes de mexer em banco/produção, edits locais primeiro → prompt Lovable depois → você aplica.

## 3. Estado atual (2026-06-23)

### ✅ Entregue e testado em produção
**Feature:** "Kit do inbound Full = 1 LINHA na separação". O dono aprovou e testou em caso real; funciona.

**O que mudou:**
- **Schema** (`full_order_items`): nova coluna `kit_id` (FK → `product_kits`), `product_id` passou a ser opcional. Constraint CHECK garante "produto OU kit" (exatamente uma chave por linha).
- **Parser do PDF** (`OrdensFullTab.tsx`): quando o EAN/SKU do PDF casa com um kit cadastrado, **NÃO expande** em componentes — vira 1 linha com `isKit:true`, `kitId`, `components` (lista dos produtos do kit, só p/ baixa de estoque).
- **Criação da ordem** (`orders.ts → createOrdemFull`): grava `kit_id` + `product_id null` na tabela relacional, e guarda `isKit`/`components` no JSONB `bipagem_state`. Consolidação por chave `kit:<id>` ou `prod:<id>`.
- **Tela de Separação** (`Separacao.tsx`): usa `bipagem_state` como fonte de verdade (senão a linha de kit sumiria no join). Bipar o código universal do kit incrementa 1 unidade na linha.
- **Finalizar separação** (`orders.ts → finalizarSeparacao`): ao baixar estoque, **expande** linhas de kit — 1 movimento por componente (`scanned × qtd-no-kit`).
- **Tipos** (`useOrdensFull.ts`): `BipagemItemState` ganhou `kitId?`, `isKit?`, `components?`.

### 📁 Arquivos do projeto (chave)
| Caminho | O quê |
|---|---|
| `src/components/OrdensFullTab.tsx` | (2003 linhas) Tela principal de ordens Full: PDF, pré-visualização, criação |
| `src/services/orders.ts` | (400 linhas) `createOrdemFull`, `finalizarSeparacao` |
| `src/pages/Separacao.tsx` | (971 linhas) Tela de separação/bipagem |
| `src/hooks/useOrdensFull.ts` | (312 linhas) Hooks + tipos `BipagemItemState`, `OrdemFull` |
| `supabase/functions/ml-full-sync/index.ts` | Edge Function de auto-sync Full (rodando em pg_cron a cada 15min via `ml_settings.full_sync_interval`) — **ver item 4.1, ATENÇÃO** |
| `supabase/functions/ml-inbound-probe/index.ts` | ⚠️ **Provisória/diagnóstica**, ainda no ar — remover quando sync real existir |
| `supabase/migrations/2026062*.sql` | Histórico de migrations |
| `PROMPT_*.md` | Prompts prontos pra colar no Lovable |

### 📜 Prompts já gerados (em `C:\Users\eduar\Desktop\STOVIX\`)
- `PROMPT_FIX_KIT_INBOUND.md`
- `PROMPT_FIX_KIT_MAPPING.md`
- `PROMPT_KIT_UMA_LINHA.md` ⬅️ **último, aplicado e funcionando**

### 🎯 Convenções e padrões do projeto
- **Edits locais primeiro** para validar build (`tsc --noEmit` + `npm run build`), **depois** gerar `PROMPT_*.md` pro Lovable.
- **Não mexer em tipos gerados do Supabase** manualmente — eles regeneram via Lovable depois de aplicar prompt. Por isso os inserts com colunas novas usam `as any` no TypeScript.
- **Não quebrar nada que já roda.** Mudanças aditivas: novo hook, novo card, nova função. Hooks antigos ficam intactos.
- **Migrations:** nome `YYYYMMDDHHMMSS_nome.sql`, rodar no SQL Editor do Supabase **antes** do deploy.
- **Cron jobs:** pg_cron chamando `net.http_post` para a Edge Function; agendado por migrations `.sql`. Padrão do projeto: `CRON_SECRET` lido de `vault.decrypted_secrets` (pode ter sido rotacionado — ver item 4.2).

## 4. Pendências e fios soltos

### 4.1 `ml-full-sync` está errado — bug crítico, NÃO usar como está
**Problema:** Quando foi construído, o "sync de Full" acabou puxando **vendas (saídas /orders/search)**, mas o usuário queria **inbounds (entradas, mostra em `myaccount.mercadolivre.com.br/shipping/inbounds`, ex.: #70358897 LOREAL UNITARIO, 570 declaradas, "Em preparação").**
- 32 ordens foram criadas por engano em `full_orders` com `descricao LIKE 'Pedido ML %'`. **Deletar antes de mexer no sync de novo:**
  ```sql
  DELETE FROM full_orders WHERE descricao LIKE 'Pedido ML %';
  ```
- **Endpoint OAuth certo para inbound não foi achado** por tentativa cega (todas 403/404). Investigação via DevTools apontou que a tela de inbounds é servida por um **BFF interno do `myaccount`** (`/shipping/inbounds` relativo, cookie-auth) — não replicável via OAuth.
- **Único caminho viável OAuth:** `/stock/fulfillment/operations/search` — exige listar inventário Full (`inventory_id`) primeiro e filtrar operations do tipo inbound. **Não implementado ainda.** Decisão do dono: seguir por aí quando retomar.

### 4.2 CRON_SECRET pode ter sido rotacionado
Houve rotação do secret do pg_cron para corrigir bloqueio de auth. Se o sync parar de rodar, conferir `SELECT name, decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET';` no Supabase; o valor precisa bater com o header `x-cron-secret` enviado pelo `net.http_post` em `pg_cron.job` (`sqljobs.job_details`).

### 4.3 Ordens antigas com kits quebrados (não-urgente)
Ordens Full criadas **antes** do prompt `PROMPT_KIT_UMA_LINHA.md` ainda têm os kits expandidos em componentes. Não quebram nada (o código aceita os dois formatos), mas não viram retroativamente "1 linha". Migrar é opcional.

### 4.4 Função temporária `ml-inbound-probe`
Edge Function diagnóstica que prova endpoints do ML. Está deployada. **Deletar** quando o sync real de inbound existir (ou decidir não existir) — está só ocupando slot.

### 4.5 Plano que originou tudo (descartado, contexto apenas)
Existia um plano em `C:\Users\eduar\.claude\plans\deep-tinkering-hedgehog.md` sobre "Dashboard ML + sync de vendas" — **esse plano foi abandonado** quando o dono percebeu que o que ele queria era sync de inbound, não de vendas. Não retomar.

## 5. Roteiro de retomada (quando sentar no novo PC)

1. **Setup**
   - `git clone` (se houver repo) ou copiar pasta inteira.
   - `npm install` no novo PC.
   - Confirmar variáveis do Supabase em `.env` (não commitar).
   - Login no Supabase (projeto `cjmoecedmsguxewyhdie`).
   - Login no Lovable (mesmo e-mail).

2. **Sanity check (10 min)**
   - Rodar `SELECT * FROM full_orders ORDER BY created_at DESC LIMIT 5;` — ver se tem dados novos desde a última vez.
   - Abrir o painel do STOVIX, navegar até Ordens Full, conferir que renderiza.
   - `npm run build` no projeto — passar sem erro.
   - Se o cron estava rodando, conferir `SELECT * FROM cron.job ORDER BY jobname;` no Supabase.

3. **Escolher uma das frentes pendentes**
   - (a) **Deletar** as 32 ordens erradas (SQL acima).
   - (b) **Construir sync de inbound** via `stock/fulfillment/operations` (feature maior; pedir plano).
   - (c) **Migrar** ordens antigas com kits quebrados.
   - (d) **Remover** `ml-inbound-probe` se for abandonada.

4. **Ao abrir nova sessão Claude**, começar com:
   "Sou o Eduar do STOVIX. Estado: feature de kit 1 linha entregue e testada. Pendências: deletar 32 ordens erradas, sync de inbound via stock operations, remover ml-inbound-probe. Continuar de onde paramos — pede o `HANDOFF_RELATORIO.md` na raiz do projeto se precisar do contexto completo."

## 6. Contatos e contas relevantes
- **Lovable** (mesmo e-mail usado pra criar o projeto).
- **Supabase** (mesmo e-mail) — projeto `cjmoecedmsguxewyhdie` (Lovable Cloud, não pessoal).
- **Mercado Livre** — seller 1075018916 (teste Full) e 228868464 (drop_off).
- **Claude/Claude Code** — plano pago; autorização pra retomar projeto.

## 7. Backup
O estado do projeto está inteiro na pasta `C:\Users\eduar\Desktop\STOVIX`. Sugestão: zipar antes da troca (`7z a STOVIX_backup.7z STOVIX`) e copiar pro novo PC — incluindo:
- Pasta completa do código.
- Os 3 `PROMPT_*.md` (essenciais pra retomar).
- Este `HANDOFF_RELATORIO.md`.

> ⚠️ **NÃO copiar para a nuvem pública** sem revisar — pode conter `.env` com segredos do Supabase. Se copiar `.env`, mover antes pra fora do zip ou redatorar.
