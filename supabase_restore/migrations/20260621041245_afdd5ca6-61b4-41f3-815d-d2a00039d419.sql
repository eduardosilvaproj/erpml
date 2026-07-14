-- Versiona os cron jobs de sincronização com o Mercado Livre.
--
-- Estes jobs já existiam no banco (criados manualmente), mas não estavam
-- versionados — então sumiriam caso o banco fosse recriado/clonado. Esta
-- migration os torna reproduzíveis e padroniza a autenticação: TODOS leem o
-- CRON_SECRET do Vault (antes o ml-full-sync usava o secret hardcoded, o que
-- quebraria silenciosamente numa rotação de secret).
--
-- Requisitos (já satisfeitos em produção):
--   - extensões pg_cron e pg_net habilitadas
--   - secret 'CRON_SECRET' cadastrado no Vault (vault.decrypted_secrets)
--   - env var CRON_SECRET das Edge Functions = mesmo valor do Vault

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove agendamentos antigos (idempotente) antes de recriar.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('ml-orders-sync', 'ml-full-sync');

-- Sincronização de pedidos (alimenta ml_orders → dashboard de vendas) a cada 30min.
SELECT cron.schedule(
  'ml-orders-sync',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjmoecedmsguxewyhdie.supabase.co/functions/v1/ml-orders-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Sincronização de pedidos Full a cada 15min (padronizado para Vault).
SELECT cron.schedule(
  'ml-full-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjmoecedmsguxewyhdie.supabase.co/functions/v1/ml-full-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{"cron":true}'::jsonb
  );
  $$
);