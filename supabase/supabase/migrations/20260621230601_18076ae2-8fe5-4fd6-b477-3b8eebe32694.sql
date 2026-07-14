create or replace function public.get_cron_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1;
$$;

revoke all on function public.get_cron_secret() from anon, authenticated;
grant execute on function public.get_cron_secret() to service_role;