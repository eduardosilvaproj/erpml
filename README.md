# Stovix - Sistema de Gestão para E-commerce

Sistema avançado de gestão integrado com Mercado Livre, focado em inteligência artificial para precificação, análise de demanda e automação de vendas.

## Configuração do Ambiente

Para rodar o projeto localmente ou configurar as Edge Functions, você precisará definir as seguintes variáveis de ambiente no seu arquivo `.env` (baseado no `.env.example`):

### Frontend (Vite)
- `VITE_SUPABASE_URL`: URL do seu projeto Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Chave anônima (anon key) do Supabase.

### Edge Functions (Supabase Secrets)
As seguintes variáveis devem ser configuradas via CLI do Supabase ou no painel do projeto:
- `MERCADO_LIVRE_APP_ID`: ID da sua aplicação no Mercado Livre.
- `MERCADO_LIVRE_CLIENT_SECRET`: Secret da sua aplicação no Mercado Livre.
- `LOVABLE_API_KEY`: Chave para acesso ao AI Gateway.
- `ASAAS_API_KEY`: Chave de API do Asaas para pagamentos.
- `ALLOWED_ORIGIN`: URL permitida para CORS (ex: `https://seu-app.lovable.app`). Se não definida, as funções usarão `*` (não recomendado para produção).

## Segurança

**IMPORTANTE:** Nunca comite o arquivo `.env` ou qualquer credencial real no repositório. O arquivo `.gitignore` já está configurado para proteger esses arquivos. Se você expôs chaves acidentalmente, rotacione-as imediatamente no painel do provedor correspondente.
