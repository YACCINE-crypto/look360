-- ============================================================================
-- 0032 — Audit sécurité : quotas et droits appliqués EN BASE, au moment de l'usage.
--
--  1. effective_plan() : un abonnement payant dont current_period_end est passé
--     compte comme 'free', même si le job d'expiration n'a pas tourné.
--  2. consume_download / consume_winner_run : utilisent le plan effectif.
--  3. reserve_usage / release_usage : réservation ATOMIQUE (FOR UPDATE) des
--     searches + market_search_units AVANT l'appel Apify. Remplace le couple
--     « vérifier puis enregistrer » qui laissait des requêtes parallèles
--     dépasser le quota.
--  4. Fonctions de quota : EXECUTE retiré à PUBLIC (0030 ne le retirait qu'à
--     anon/authenticated, qui l'héritaient encore via PUBLIC).
--  5. Stockage média (Bunny) : compteur d'objets par compte, plafonné par offre.
--  6. competitors_watch : nombre de slots appliqué par trigger ; colonnes gérées
--     par le cron (last_checked_at, known_ad_ids) non modifiables par le client.
-- ============================================================================

-- 1) Plan effectif. Un plan payant sans date de fin est conservé (cas posé à la
--    main) ; seul un plan dont la fin est PASSÉE retombe au gratuit. Un compte
--    suspendu vaut aussi 'free' : plus aucune consommation payante (crons compris).
create or replace function public.effective_plan(p_user uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when exists (select 1 from public.profiles where id = p_user and suspended) then 'free'
    else coalesce(
      (select case
                when plan <> 'free' and current_period_end is not null and current_period_end <= now()
                  then 'free'
                else plan
              end
         from public.subscriptions where user_id = p_user),
      'free')
  end;
$$;

-- 2) Consommations atomiques sur le plan effectif.
create or replace function public.consume_download(p_user uuid)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_lim int; v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  select current_period_start, current_period_end into v_start, v_end
    from public.subscriptions where user_id = p_user;
  if v_start is null then
    v_start := date_trunc('month', now()); v_end := v_start + interval '1 month';
  end if;
  select monthly_video_downloads into v_lim from public.plan_limits where plan = public.effective_plan(p_user);
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

create or replace function public.consume_winner_run(p_user uuid)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_lim int; v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  select current_period_start, current_period_end into v_start, v_end
    from public.subscriptions where user_id = p_user;
  if v_start is null then
    v_start := date_trunc('month', now()); v_end := v_start + interval '1 month';
  end if;
  select monthly_winner_agent_runs into v_lim from public.plan_limits where plan = public.effective_plan(p_user);
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

-- 3) Réservation atomique searches + units (pire cas), puis restitution de ce
--    qui n'a pas été consommé (hits de cache, échec, plafond journalier).
create or replace function public.reserve_usage(p_user uuid, p_searches int, p_units int)
returns public.subscription_usage
language plpgsql security definer set search_path to 'public' as $$
declare v_s int; v_u int; v_start timestamptz; v_end timestamptz; v_row public.subscription_usage;
begin
  p_searches := greatest(0, coalesce(p_searches, 0));
  p_units := greatest(0, coalesce(p_units, 0));
  select current_period_start, current_period_end into v_start, v_end
    from public.subscriptions where user_id = p_user;
  if v_start is null then
    v_start := date_trunc('month', now()); v_end := v_start + interval '1 month';
  end if;
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
    where user_id = p_user and period_start = public.current_period_start(p_user)
    returning * into v_row;
  return v_row;
end; $$;

-- 5) Stockage média : nombre d'objets archivés par compte (cumulé, décrémenté
--    quand un objet est supprimé). Plafond par offre, ajustable ici.
alter table public.plan_limits add column if not exists max_stored_media int not null default 0;
update public.plan_limits set max_stored_media = case plan
  when 'free' then 50 when 'starter' then 1000 when 'pro' then 5000 when 'business' then 20000 end;

create table if not exists public.media_storage_usage (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  objects    int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.media_storage_usage enable row level security;
drop policy if exists media_storage_usage_select on public.media_storage_usage;
create policy media_storage_usage_select on public.media_storage_usage
  for select using (user_id = (select auth.uid()));
revoke all on public.media_storage_usage from anon, authenticated;
grant select on public.media_storage_usage to authenticated;

create or replace function public.reserve_media(p_user uuid, p_n int)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_lim int; v_cur int;
begin
  p_n := greatest(0, coalesce(p_n, 0));
  select max_stored_media into v_lim from public.plan_limits where plan = public.effective_plan(p_user);
  insert into public.media_storage_usage(user_id) values (p_user) on conflict (user_id) do nothing;
  select objects into v_cur from public.media_storage_usage where user_id = p_user for update;
  if v_cur + p_n > coalesce(v_lim, 0) then
    raise exception 'quota_media' using errcode = 'P0001';
  end if;
  update public.media_storage_usage set objects = objects + p_n, updated_at = now()
    where user_id = p_user returning objects into v_cur;
  return v_cur;
end; $$;

create or replace function public.release_media(p_user uuid, p_n int)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_cur int;
begin
  update public.media_storage_usage
    set objects = greatest(0, objects - greatest(0, coalesce(p_n, 0))), updated_at = now()
    where user_id = p_user returning objects into v_cur;
  return coalesce(v_cur, 0);
end; $$;

-- 4) Fonctions de quota : service_role uniquement.
do $$
declare fn text;
begin
  foreach fn in array array[
    'effective_plan(uuid)',
    'current_period_start(uuid)',
    'get_usage(uuid)',
    'record_search_usage(uuid,int)',
    'consume_download(uuid)',
    'consume_winner_run(uuid)',
    'reserve_usage(uuid,int,int)',
    'release_usage(uuid,int,int)',
    'reserve_media(uuid,int)',
    'release_media(uuid,int)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated;', fn);
    execute format('grant execute on function public.%s to service_role;', fn);
  end loop;
end $$;

-- 6) competitors_watch : slots appliqués en base, colonnes du cron protégées.
revoke insert, update on public.competitors_watch from anon, authenticated;
grant insert (user_id, page_id, page_name, domaine, country) on public.competitors_watch to authenticated;
-- Seule la remise à zéro du badge reste côté client (page Analyse).
grant update (new_ads_count) on public.competitors_watch to authenticated;

create or replace function public.enforce_competitor_slots()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_lim int; v_cnt int;
begin
  -- Sérialise les insertions d'un même compte (pas de dépassement en parallèle).
  perform pg_advisory_xact_lock(hashtext('competitors_watch:' || new.user_id::text));
  -- Ré-suivre une page déjà suivie (upsert) ne consomme pas de slot.
  if exists (select 1 from public.competitors_watch
             where user_id = new.user_id and page_id = new.page_id) then
    return new;
  end if;
  select max_tracked_competitors into v_lim
    from public.plan_limits where plan = public.effective_plan(new.user_id);
  select count(*) into v_cnt from public.competitors_watch where user_id = new.user_id;
  if v_cnt >= coalesce(v_lim, 0) then
    raise exception 'quota_competitors' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke all on function public.enforce_competitor_slots() from public, anon, authenticated;
drop trigger if exists competitors_watch_slots on public.competitors_watch;
create trigger competitors_watch_slots before insert on public.competitors_watch
  for each row execute function public.enforce_competitor_slots();


-- 7) Vitrine : réservée au plan Business EFFECTIF (période en cours).
create or replace function public.vitrine_winners()
returns table (
  categorie    text,
  marche       text,
  marge_pct    int,
  closing_pct  int,
  validated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (select auth.uid() as uid),
  latest as (
    -- dernier test par produit
    select distinct on (t.produit_id)
      t.produit_id,
      t.prix_vente_prevu,
      t.commandes_recues,
      t.commandes_confirmees,
      t.depense_pub,
      t.cout_produit_estime,
      t.frais_livraison_prevu
    from public.tests t
    order by t.produit_id, t.created_at desc
  )
  select
    p.categorie,
    p.marche,
    round(
      ((coalesce(l.prix_vente_prevu, 0) - coalesce(l.cout_produit_estime, 0) - coalesce(l.frais_livraison_prevu, 0))
        * coalesce(l.commandes_confirmees, 0) - coalesce(l.depense_pub, 0))
      / nullif(coalesce(l.prix_vente_prevu, 0) * coalesce(l.commandes_confirmees, 0), 0) * 100
    )::int as marge_pct,
    round(
      coalesce(l.commandes_confirmees, 0)::numeric / nullif(l.commandes_recues, 0) * 100
    )::int as closing_pct,
    p.created_at as validated_at
  from public.produits p
  join latest l on l.produit_id = p.id
  join public.profiles pr on pr.id = p.soumis_par
  where p.statut = 'valide'
    and coalesce(l.commandes_recues, 0) >= 10
    and pr.vitrine_share = true
    and p.soumis_par is distinct from (select uid from me)
    and public.effective_plan((select uid from me)) = 'business'
  order by p.created_at desc
  limit 60;
$$;
revoke all on function public.vitrine_winners() from public, anon, authenticated;
grant execute on function public.vitrine_winners() to authenticated;

-- 8) spy_saved_ads : écritures uniquement par la route serveur (service_role),
--    qui applique le quota de stockage. Le client garde lecture + suppression.
revoke insert, update on public.spy_saved_ads from anon, authenticated;
