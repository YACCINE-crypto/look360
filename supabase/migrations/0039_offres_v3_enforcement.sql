-- 0039 — Offres v3 + gating 100 % serveur.
--
--  1. plan_limits : nouvelles valeurs (recherches 5/200/400/600, concurrents
--     0/2/5/10, Winner Agent 3/10 mots-clés, WhatsApp Pro+Business) et niveaux
--     d'accès (Top Trend, Feed, pages, Mes produits, enrichissement).
--  2. Période d'usage : date anniversaire pour un plan payant effectif, mois
--     calendaire pour le gratuit (usage_period).
--  3. Recherche : 1 recherche = 1 mot-clé × 1 pays = 1 appel Apify. Réservation
--     atomique (FOR UPDATE), réservée aux e-mails vérifiés. can_search() + my_quota().
--  4. Téléchargements : plus de quota mensuel, garde-fou anti-abus 100/jour.
--  5. Plafonds d'ajout appliqués par trigger : Mes produits, pubs sauvegardées,
--     Winner Agent. Les données existantes ne sont jamais supprimées.
--  6. (Catalogue partagé : voir 0040, appliquée avec le déploiement du code.)
--  7. État de facturation (bannières) : my_billing_state().
-- Aucune modification de payments / apply_payment_success / SasPay.

-- 1) Niveaux d'accès + valeurs v3 --------------------------------------------
alter table public.plan_limits
  add column if not exists top_trend_access text not null default 'locked'
    check (top_trend_access in ('locked','preview','full')),
  add column if not exists top_trend_preview int,           -- nb d'éléments (par type) en aperçu
  add column if not exists feed_access text not null default 'partial'
    check (feed_access in ('partial','full')),
  add column if not exists feed_limit int,                   -- NULL = illimité
  add column if not exists pages_access text not null default 'teaser'
    check (pages_access in ('teaser','full')),
  add column if not exists pages_limit int,                  -- NULL = illimité
  add column if not exists mes_produits_max int,             -- NULL = illimité (tests inclus)
  add column if not exists enrichment text not null default 'none'
    check (enrichment in ('none','basic','full')),
  add column if not exists daily_downloads int not null default 100;

update public.plan_limits set
  monthly_searches            = v.searches,
  monthly_market_search_units = v.searches,          -- 1 recherche = 1 pays = 1 unit (ceinture coût cachée)
  max_markets_per_search      = v.markets,
  max_tracked_competitors     = v.competitors,
  winner_agent_enabled        = v.winner_on,
  winner_agent_keywords       = v.winner_kw,
  whatsapp_winners_enabled    = v.whatsapp,
  validated_winners_showcase  = v.vitrine,
  max_saved_products          = v.saved,
  top_trend_access            = v.tt,
  top_trend_preview           = v.tt_n,
  feed_access                 = v.feed,
  feed_limit                  = v.feed_n,
  pages_access                = v.pages,
  pages_limit                 = v.pages_n,
  mes_produits_max            = v.mes_max,
  enrichment                  = v.enrich,
  daily_downloads             = 100
from (values
  ('free',      5, 1,  0, false,  0, false, false,    20, 'locked',  null, 'partial',   20, 'teaser',    5,   50, 'none'),
  ('starter', 200, 2,  2, false,  0, false, false,   500, 'preview',    3, 'full',    null, 'full',   null, null, 'basic'),
  ('pro',     400, 3,  5, true,   3, true,  false,  2500, 'full',    null, 'full',    null, 'full',   null, null, 'full'),
  ('business',600, 5, 10, true,  10, true,  true,  10000, 'full',    null, 'full',    null, 'full',   null, null, 'full')
) as v(plan, searches, markets, competitors, winner_on, winner_kw, whatsapp, vitrine, saved,
       tt, tt_n, feed, feed_n, pages, pages_n, mes_max, enrich)
where plan_limits.plan = v.plan;

-- Écriture réservée au service_role (lecture : tout compte connecté, policy 0030).
revoke insert, update, delete, truncate on public.plan_limits from anon, authenticated;

-- 2) Période d'usage ----------------------------------------------------------
create or replace function public.usage_period(p_user uuid, out p_start timestamptz, out p_end timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if public.effective_plan(p_user) <> 'free' then
    select current_period_start, current_period_end into p_start, p_end
      from public.subscriptions where user_id = p_user;
  end if;
  if p_start is null then
    p_start := date_trunc('month', now());
    p_end := p_start + interval '1 month';
  end if;
end; $$;

create or replace function public.current_period_start(p_user uuid)
returns timestamptz language sql stable security definer set search_path to 'public' as $$
  select (public.usage_period(p_user)).p_start;
$$;

create or replace function public.get_usage(p_user uuid)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  select p_start, p_end into v_start, v_end from public.usage_period(p_user);
  insert into public.subscription_usage(user_id, period_start, period_end)
    values (p_user, v_start, v_end) on conflict (user_id, period_start) do nothing;
  select * into v_row from public.subscription_usage where user_id = p_user and period_start = v_start;
  return v_row;
end; $$;

create or replace function public.record_search_usage(p_user uuid, p_units int)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  select p_start, p_end into v_start, v_end from public.usage_period(p_user);
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

-- 3) Recherche ----------------------------------------------------------------
create or replace function public.email_verified(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public', 'auth' as $$
  select coalesce((select email_confirmed_at is not null from auth.users where id = p_user), false);
$$;

-- Réservation atomique AVANT l'appel Apify (pire cas), restituée ensuite si
-- rien n'a été consommé. Erreurs : email_unverified | quota_searches | quota_units.
create or replace function public.reserve_usage(p_user uuid, p_searches int, p_units int)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_s int; v_u int; v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  p_searches := greatest(0, coalesce(p_searches, 0));
  p_units := greatest(0, coalesce(p_units, 0));
  if not public.email_verified(p_user) then
    raise exception 'email_unverified' using errcode = 'P0001';
  end if;
  select p_start, p_end into v_start, v_end from public.usage_period(p_user);
  select monthly_searches, monthly_market_search_units into v_s, v_u
    from public.plan_limits where plan = public.effective_plan(p_user);
  insert into public.subscription_usage(user_id, period_start, period_end)
    values (p_user, v_start, v_end) on conflict (user_id, period_start) do nothing;
  select * into v_row from public.subscription_usage
    where user_id = p_user and period_start = v_start for update;
  if v_row.searches_used + p_searches > coalesce(v_s, 0) then
    raise exception 'quota_searches' using errcode = 'P0001';
  end if;
  if v_row.market_search_units_used + p_units > coalesce(v_u, 0) then
    raise exception 'quota_units' using errcode = 'P0001';
  end if;
  update public.subscription_usage
    set searches_used = searches_used + p_searches,
        market_search_units_used = market_search_units_used + p_units,
        updated_at = now()
    where user_id = p_user and period_start = v_start
    returning * into v_row;
  return v_row;
end; $$;

create or replace function public.release_usage(p_user uuid, p_searches int, p_units int)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_row public.subscription_usage;
begin
  update public.subscription_usage
    set searches_used = greatest(0, searches_used - greatest(0, coalesce(p_searches, 0))),
        market_search_units_used = greatest(0, market_search_units_used - greatest(0, coalesce(p_units, 0))),
        updated_at = now()
    where user_id = p_user and period_start = (public.usage_period(p_user)).p_start
    returning * into v_row;
  return v_row;
end; $$;

-- Lecture seule du quota de recherche (ne réserve rien).
create or replace function public.can_search(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_plan text; v_lim int; v_used int; v_start timestamptz; v_end timestamptz; v_ok boolean;
begin
  v_plan := public.effective_plan(p_user);
  select monthly_searches into v_lim from public.plan_limits where plan = v_plan;
  select p_start, p_end into v_start, v_end from public.usage_period(p_user);
  select searches_used into v_used from public.subscription_usage
    where user_id = p_user and period_start = v_start;
  v_used := coalesce(v_used, 0);
  v_ok := public.email_verified(p_user);
  return jsonb_build_object(
    'plan', v_plan,
    'limit', coalesce(v_lim, 0),
    'used', v_used,
    'remaining', greatest(0, coalesce(v_lim, 0) - v_used),
    'period_end', v_end,
    'email_verified', v_ok,
    'allowed', v_ok and v_used < coalesce(v_lim, 0),
    'reason', case when not v_ok then 'email_unverified'
                   when v_used >= coalesce(v_lim, 0) then 'quota_atteint' end
  );
end; $$;

-- Version « moi » appelable par le client (lit uniquement son propre quota).
create or replace function public.my_quota()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when auth.uid() is null then null else public.can_search(auth.uid()) end;
$$;

-- Plan effectif de l'appelant (utilisé par les policies RLS).
create or replace function public.my_plan()
returns text language sql stable security definer set search_path to 'public' as $$
  select case when auth.uid() is null then 'free' else public.effective_plan(auth.uid()) end;
$$;

-- 4) Téléchargements : garde-fou anti-abus quotidien --------------------------
create table if not exists public.download_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null default current_date,
  n       int  not null default 0,
  primary key (user_id, day)
);
alter table public.download_daily enable row level security;
revoke all on public.download_daily from anon, authenticated;

drop function if exists public.consume_download(uuid);
create function public.consume_download(p_user uuid)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_lim int; v_n int;
begin
  select daily_downloads into v_lim from public.plan_limits where plan = public.effective_plan(p_user);
  insert into public.download_daily(user_id, day) values (p_user, current_date)
    on conflict (user_id, day) do nothing;
  select n into v_n from public.download_daily where user_id = p_user and day = current_date for update;
  if v_n + 1 > coalesce(v_lim, 100) then
    raise exception 'quota_downloads' using errcode = 'P0001';
  end if;
  update public.download_daily set n = n + 1 where user_id = p_user and day = current_date returning n into v_n;
  delete from public.download_daily where day < current_date - 7;   -- ménage
  return v_n;
end; $$;

-- 5) Plafonds d'ajout (triggers) ----------------------------------------------
-- Mes produits (Validation/Testing) : 50 au total en gratuit, tests inclus.
create or replace function public.enforce_mes_produits()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_lim int; v_cnt int;
begin
  if new.soumis_par is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('produits:' || new.soumis_par::text));
  select mes_produits_max into v_lim from public.plan_limits
    where plan = public.effective_plan(new.soumis_par);
  if v_lim is null then return new; end if;
  select count(*) into v_cnt from public.produits where soumis_par = new.soumis_par;
  if v_cnt >= v_lim then
    raise exception 'quota_produits' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists produits_quota on public.produits;
create trigger produits_quota before insert on public.produits
  for each row execute function public.enforce_mes_produits();

-- Pubs sauvegardées (Spy).
create or replace function public.enforce_saved_ads()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_lim int; v_cnt int;
begin
  perform pg_advisory_xact_lock(hashtext('spy_saved_ads:' || new.user_id::text));
  if exists (select 1 from public.spy_saved_ads where user_id = new.user_id and ad_archive_id = new.ad_archive_id) then
    return new;   -- re-sauvegarde (upsert) : pas de nouvelle place
  end if;
  select max_saved_products into v_lim from public.plan_limits where plan = public.effective_plan(new.user_id);
  select count(*) into v_cnt from public.spy_saved_ads where user_id = new.user_id;
  if v_cnt >= coalesce(v_lim, 0) then
    raise exception 'quota_saved' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists spy_saved_ads_quota on public.spy_saved_ads;
create trigger spy_saved_ads_quota before insert on public.spy_saved_ads
  for each row execute function public.enforce_saved_ads();

-- Winner Agent : refusé si l'offre ne l'inclut pas ; nb de mots-clés / pays plafonné.
-- Une config désactivée (active = false) reste modifiable : on peut toujours éteindre.
create or replace function public.enforce_winner_config()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare l public.plan_limits;
begin
  if not coalesce(new.active, false) then return new; end if;
  select * into l from public.plan_limits where plan = public.effective_plan(new.user_id);
  if not coalesce(l.winner_agent_enabled, false) then
    raise exception 'quota_winner' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(new.keywords), 0) > l.winner_agent_keywords then
    raise exception 'quota_winner_keywords' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(new.countries), 0) > l.winner_agent_countries then
    raise exception 'quota_winner_countries' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists winner_agent_config_quota on public.winner_agent_config;
create trigger winner_agent_config_quota before insert or update on public.winner_agent_config
  for each row execute function public.enforce_winner_config();

-- 7) État de facturation (bannières) ------------------------------------------
alter table public.subscriptions
  add column if not exists expired_plan text,
  add column if not exists expired_at timestamptz;

-- Mémorise l'offre perdue au passage du cron (pour « ton abonnement Pro a expiré le … »).
create or replace function public.remember_expired_plan()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.plan <> 'free' and new.plan = 'free' then
    new.expired_plan := old.plan;
    new.expired_at := coalesce(old.current_period_end, now());
  elsif new.plan <> 'free' then
    new.expired_plan := null;
    new.expired_at := null;
  end if;
  return new;
end; $$;
drop trigger if exists subscriptions_remember_expired on public.subscriptions;
create trigger subscriptions_remember_expired before update of plan on public.subscriptions
  for each row execute function public.remember_expired_plan();

create or replace function public.billing_state(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare s public.subscriptions; v_eff text; v_last_ok timestamptz; p record; v_banner text;
        v_bplan text; v_bdate timestamptz;
begin
  select * into s from public.subscriptions where user_id = p_user;
  v_eff := public.effective_plan(p_user);
  select max(created_at) into v_last_ok from public.payments
    where user_id = p_user and status = 'success' and purpose = 'subscription';
  select status, plan, created_at into p from public.payments
    where user_id = p_user and purpose = 'subscription'
    order by created_at desc limit 1;

  if p.status = 'pending' and p.created_at > now() - interval '24 hours'
     and (v_last_ok is null or p.created_at > v_last_ok) then
    v_banner := 'pending'; v_bplan := p.plan;
  elsif p.status = 'failed' and (v_last_ok is null or p.created_at > v_last_ok)
     and v_eff = 'free' then
    v_banner := 'failed'; v_bplan := p.plan;
  elsif s.plan is not null and s.plan <> 'free' and v_eff = 'free'
     and s.current_period_end is not null and s.current_period_end <= now() then
    v_banner := 'expired'; v_bplan := s.plan; v_bdate := s.current_period_end;   -- cron pas encore passé
  elsif v_eff = 'free' and s.expired_plan is not null then
    v_banner := 'expired'; v_bplan := s.expired_plan; v_bdate := s.expired_at;
  end if;

  return jsonb_build_object(
    'plan', coalesce(s.plan, 'free'),
    'effective_plan', v_eff,
    'period_end', case when v_eff <> 'free' then s.current_period_end end,
    'banner', v_banner,
    'banner_plan', v_bplan,
    'banner_date', v_bdate
  );
end; $$;

create or replace function public.my_billing_state()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when auth.uid() is null then null else public.billing_state(auth.uid()) end;
$$;

-- 8) Droits d'exécution ---------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'usage_period(uuid)', 'current_period_start(uuid)', 'get_usage(uuid)',
    'record_search_usage(uuid,int)', 'reserve_usage(uuid,int,int)', 'release_usage(uuid,int,int)',
    'can_search(uuid)', 'email_verified(uuid)', 'consume_download(uuid)', 'billing_state(uuid)',
    'enforce_mes_produits()', 'enforce_saved_ads()', 'enforce_winner_config()', 'remember_expired_plan()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated;', fn);
    execute format('grant execute on function public.%s to service_role;', fn);
  end loop;
  foreach fn in array array['my_quota()', 'my_plan()', 'my_billing_state()'] loop
    execute format('revoke all on function public.%s from public, anon;', fn);
    execute format('grant execute on function public.%s to authenticated, service_role;', fn);
  end loop;
end $$;

-- 9) Reprise : comptes déjà repassés en gratuit par le cron → offre perdue
--    retrouvée depuis leur dernier paiement d'abonnement réussi.
update public.subscriptions s set
  expired_plan = p.plan,
  expired_at = s.current_period_start
from (select distinct on (user_id) user_id, plan from public.payments
      where status = 'success' and purpose = 'subscription'
      order by user_id, created_at desc) p
where p.user_id = s.user_id and s.plan = 'free' and s.status = 'expired' and s.expired_plan is null;
