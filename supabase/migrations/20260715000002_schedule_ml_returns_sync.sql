-- ============================================================
-- Agendamento do sync automático de devoluções (pg_cron)
-- ============================================================

-- Remove agendamento anterior, se existir
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'ml-returns-sync';

-- Agenda a cada 30 minutos
SELECT cron.schedule(
  'ml-returns-sync',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjmoecedmsguxewyhdie.supabase.co/functions/v1/ml-returns-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{"cron":true}'::jsonb
  );
  $$
);