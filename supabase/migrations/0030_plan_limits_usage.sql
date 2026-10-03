-- ============================================================================
-- 0030 — Modèle « niveau d'accès + quotas » (v2 offres). Remplace le gating par
-- crédits VISIBLES : on compte désormais des searches + market_search_units
-- côté serveur. Le moteur de crédits (0017) reste en place (dormant) pour ne
-- rien casser ; l'enforcement passe par plan_limits + subscription_usage.
--
--   search              = 1 recherche utilisateur
--   market_search_unit  = 1 recherche exécutée sur 1 marché (coût Apify réel)
--
-- Tout est compté CÔTÉ SERVEUR (SECURITY DEFINER + service_role). Un hit du
-- cache partagé ne consomme PAS d'unit.
-- ============================================================================

-- 1) Config par offre (lisible par le client pour l'affichage ; écriture service_role).
create table if not exists public.plan_limits (
  plan                         text primary key
                               check (plan in ('free','starter','pro','business')),
  monthly_searches             int  not null default 0,
  monthly_market_search_units  int  not null default 0,
  max_markets_per_search       int  not null default 0,
  max_tracked_competitors      int  not null default 0,
  monthly_video_downloads      int  not null default 0,
  max_saved_products           int  not null default 0,
  winner_agent_enabled         boolean not null default false,
  winner_agent_keywords        int  not null default 0,
  winner_agent_countries       int  not null default 0,
  monthly_winner_agent_runs    int  not null default 0,
  whatsapp_winners_enabled     boolean not null default false,
  validated_winners_showcase   boolean not null default false,
  support_level                text not null default 'none'
);
alter table public.plan_limits enable row level security;
drop policy if exists plan_limits_read on public.plan_limits;
create policy plan_limits_read on public.plan_limits for select to authenticated using (true);

insert into public.plan_limits (
  plan, monthly_searches, monthly_market_search_units, max_markets_per_search,
  max_tracked_competitors, monthly_video_downloads, max_saved_products,
  winner_agent_enabled, winner_agent_keywords, winner_agent_countries,
  monthly_winner_agent_runs, whatsapp_winners_enabled, validated_winners_showcase, support_level
) values
  ('free',     0,   0,   0,  0,    0,     0,    false, 0, 0, 0,  false, false, 'none'),
  ('starter',  250, 300, 2,  1,    100,   500,  false, 0, 0, 0,  false, false, 'standard'),
  ('pro',      500, 600, 3,  3,    500,   2500, true,  2, 1, 30, false, false, 'prioritaire'),
  ('business', 700, 800, 5,  10,   1500,  10000,true,  5, 2, 60, true,  true,  'vip')
on conflict (plan) do update set
  monthly_searches = excluded.monthly_searches,
  monthly_market_search_units = excluded.monthly_market_search_units,
  max_markets_per_search = excluded.max_markets_per_search,
  max_tracked_competitors = excluded.max_tracked_competitors,
  monthly_video_downloads = excluded.monthly_video_downloads,
  max_saved_products = excluded.max_saved_products,
  winner_agent_enabled = excluded.winner_agent_enabled,
  winner_agent_keywords = excluded.winner_agent_keywords,
  winner_agent_countries = excluded.winner_agent_countries,
  monthly_winner_agent_runs = excluded.monthly_winner_agent_runs,
  whatsapp_winners_enabled = excluded.whatsapp_winners_enabled,
  validated_winners_showcase = excluded.validated_winners_showcase,
  support_level = excluded.support_level;

-- 2) Usage mensuel par utilisateur (période = période d'abonnement ; mois
--    calendaire si aucune fin de période — cas Gratuit). Compteurs serveur.
create table if not exists public.subscription_usage (
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  period_start              timestamptz not null,
  period_end                timestamptz,
  searches_used             int not null default 0,
  market_search_units_used  int not null default 0,
  video_downloads_used      int not null default 0,
  winner_agent_runs         int not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  primary key (user_id, period_start)
);
alter table public.subscription_usage enable row level security;
drop policy if exists subscription_usage_select on public.subscription_usage;
create policy subscription_usage_select on public.subscription_usage
  for select using (user_id = (select auth.uid()));

-- 3) Début de période courante d'un user (depuis son abonnement).
create or replace function public.current_period_start(p_user uuid)
returns timestamptz language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select current_period_start from public.subscriptions where user_id = p_user),
    date_trunc('month', now())
  );
$$;

-- 4) Ligne d'usage courante (créée si absente). Lecture fiable pour l'affichage.
create or replace function public.get_usage(p_user uuid)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  select current_period_start, current_period_end into v_start, v_end
    from public.subscriptions where user_id = p_user;
  if v_start is null then
    v_start := date_trunc('month', now());
    v_end := v_start + interval '1 month';
  end if;
  insert into public.subscription_usage(user_id, period_start, period_end)
    values (p_user, v_start, v_end)
    on conflict (user_id, period_start) do nothing;
  select * into v_row from public.subscription_usage
    where user_id = p_user and period_start = v_start;
  return v_row;
end; $$;

-- 5) Enregistre la consommation d'une recherche : +1 search, +N units (N =
--    marchés réellement exécutés sur Apify ; un hit de cache = 0 unit).
--    Le contrôle de quota « worst case » est fait côté app AVANT l'appel Apify ;
--    ici on incrémente (borné par ce contrôle). N peut être 0 (tout en cache).
create or replace function public.record_search_usage(p_user uuid, p_units int)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  select current_period_start, current_period_end into v_start, v_end
    from public.subscriptions where user_id = p_user;
  if v_start is null then
    v_start := date_trunc('month', now());
    v_end := v_start + interval '1 month';
  end if;
  insert into public.subscription_usage(user_id, period_start, period_end)
    values (p_user, v_start, v_end) on conflict (user_id, period_start) do nothing;
  update public.subscription_usage
    set searches_used = searches_used + 1,
        market_search_units_used = market_search_units_used + greatest(0, coalesce(p_units, 0)),
        updated_at = now()
    where user_id = p_user and period_start = v_start
    returning * into v_row;
  return v_row;
end; $$;

-- 6) Consomme un téléchargement vidéo (vérif + incrément atomiques). Lève
--    'quota_downloads' si le plafond mensuel est atteint. À appeler AVANT de servir.
create or replace function public.consume_download(p_user uuid)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_plan text; v_lim int; v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  select plan, current_period_start, current_period_end into v_plan, v_start, v_end
    from public.subscriptions where user_id = p_user;
  if v_start is null then
    v_start := date_trunc('month', now()); v_end := v_start + interval '1 month';
  end if;
  select monthly_video_downloads into v_lim from public.plan_limits where plan = coalesce(v_plan,'free');
  v_lim := coalesce(v_lim, 0);
  insert into public.subscription_usage(user_id, period_start, period_end)
    values (p_user, v_start, v_end) on conflict (user_id, period_start) do nothing;
  select * into v_row from public.subscription_usage
    where user_id = p_user and period_start = v_start for update;
  if v_row.video_downloads_used + 1 > v_lim then
    raise exception 'quota_downloads' using errcode = 'P0001';
  end if;
  update public.subscription_usage set video_downloads_used = video_downloads_used + 1, updated_at = now()
    where user_id = p_user and period_start = v_start returning * into v_row;
  return v_row;
end; $$;

-- 7) Consomme une exécution Winner Agent (vérif + incrément). Lève 'quota_winner_runs'.
create or replace function public.consume_winner_run(p_user uuid)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_plan text; v_lim int; v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  select plan, current_period_start, current_period_end into v_plan, v_start, v_end
    from public.subscriptions where user_id = p_user;
  if v_start is null then
    v_start := date_trunc('month', now()); v_end := v_start + interval '1 month';
  end if;
  select monthly_winner_agent_runs into v_lim from public.plan_limits where plan = coalesce(v_plan,'free');
  v_lim := coalesce(v_lim, 0);
  insert into public.subscription_usage(user_id, period_start, period_end)
    values (p_user, v_start, v_end) on conflict (user_id, period_start) do nothing;
  select * into v_row from public.subscription_usage
    where user_id = p_user and period_start = v_start for update;
  if v_row.winner_agent_runs + 1 > v_lim then
    raise exception 'quota_winner_runs' using errcode = 'P0001';
  end if;
  update public.subscription_usage set winner_agent_runs = winner_agent_runs + 1, updated_at = now()
    where user_id = p_user and period_start = v_start returning * into v_row;
  return v_row;
end; $$;

-- Exécution réservée au service_role (jamais au client).
revoke execute on function public.get_usage(uuid) from anon, authenticated;
revoke execute on function public.record_search_usage(uuid,int) from anon, authenticated;
revoke execute on function public.consume_download(uuid) from anon, authenticated;
revoke execute on function public.consume_winner_run(uuid) from anon, authenticated;
revoke execute on function public.current_period_start(uuid) from anon, authenticated;
