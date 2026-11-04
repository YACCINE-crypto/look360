-- ============================================================================
-- 0036 — Limitation des tentatives (connexion, inscription, mot de passe oublié)
-- Audit sécurité 2026-11-04, contrôles 11/12. Stockage fiable en base (pas en
-- mémoire : les fonctions serverless ne partagent rien entre instances).
-- Accès serveur uniquement (service_role) : aucune règle RLS, aucun droit client.
-- ============================================================================

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Compte une tentative dans la fenêtre courante ; true = autorisée.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  -- Ménage occasionnel des vieilles fenêtres.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return n <= p_max;
end;
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- Durcissement signalé par l'audit (search_path fixé).
alter function public.is_non_shop_domain(text) set search_path = public;
