-- Quitar limites de cuota durante desarrollo para permitir pruebas libres.
-- Los limites reales se re-agregaran con una migracion nueva antes de
-- pasar a produccion (ver roadmap v2.19).

alter table public.user_ai_settings
  alter column daily_request_limit set default 2000000000,
  alter column monthly_request_limit set default 2000000000,
  alter column daily_token_limit set default 2000000000,
  alter column monthly_token_limit set default 2000000000;

update public.user_ai_settings
set
  daily_request_limit = 2000000000,
  monthly_request_limit = 2000000000,
  daily_token_limit = 2000000000,
  monthly_token_limit = 2000000000,
  updated_at = clock_timestamp();
