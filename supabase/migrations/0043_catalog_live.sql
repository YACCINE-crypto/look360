alter table public.shop_products add column if not exists discovered_at timestamptz;
alter table public.shop_products add column if not exists winner_score smallint not null default 0;
alter table public.shops add column if not exists winner_score smallint not null default 0;

create index if not exists shop_products_discovered_idx on public.shop_products (discovered_at desc nulls last) where ads_count > 0;
create index if not exists shop_products_score_idx on public.shop_products (winner_score desc);
create index if not exists shops_first_seen_idx on public.shops (first_seen desc);
create index if not exists shops_score_idx on public.shops (winner_score desc);

create or replace function public.catalog_score(p_active bigint, p_total bigint, p_first date, p_reach numeric, p_total_cap integer default 10)
returns smallint
language sql
immutable
as $fn$
  select least(100,
      least(coalesce(p_active, 0), 10) * 6
    + least(coalesce(p_total, 0), p_total_cap) * (20 / p_total_cap)
    + case when p_first >= current_date - 14 then 10 when p_first >= current_date - 45 then 5 else 0 end
    + case when p_reach >= 100000 then 10 when p_reach >= 10000 then 5 else 0 end
  )::smallint;
$fn$;

create or replace function public.catalog_reaggregate(p_domains text[] default null, p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_n integer;
begin
  update public.shops s set
    ads_count = coalesce(a.n, 0),
    ads_active = coalesce(a.n_active, 0),
    ad_countries = coalesce(a.countries, s.ad_countries),
    eu_reach = a.reach,
    first_ad_date = coalesce(a.first_ad, s.first_ad_date),
    niches = coalesce(a.niches, s.niches),
    winner_score = public.catalog_score(coalesce(a.n_active, 0), coalesce(a.n, 0), coalesce(a.first_ad, s.first_ad_date), a.reach, 20)
  from public.shops s2
  left join (
    select domain, count(*) as n, count(*) filter (where is_active) as n_active,
           array_remove(array_agg(distinct country), null) as countries,
           nullif(sum(reach), 0) as reach, min(start_date) as first_ad,
           array_remove(array_agg(distinct niche), null) as niches
    from public.shop_ad_links
    where seen_at > now() - make_interval(days => p_days)
      and (p_domains is null or domain = any (p_domains))
    group by domain
  ) a on a.domain = s2.domain
  where s.id = s2.id
    and (p_domains is null or s2.domain = any (p_domains));
  get diagnostics v_n = row_count;

  update public.shop_products p set
    ads_count = coalesce(a.n, 0),
    ads_active = coalesce(a.n_active, 0),
    first_ad_date = coalesce(a.first_ad, p.first_ad_date),
    eu_reach = a.reach,
    niche = coalesce(a.niche, p.niche),
    discovered_at = case when coalesce(a.n, 0) > 0 then coalesce(p.discovered_at, a.first_seen, now()) else p.discovered_at end,
    winner_score = public.catalog_score(coalesce(a.n_active, 0), coalesce(a.n, 0), coalesce(a.first_ad, p.first_ad_date), a.reach, 10)
  from public.shops s
  left join lateral (
    select l.handle, count(*) as n, count(*) filter (where l.is_active) as n_active,
           min(l.start_date) as first_ad, nullif(sum(l.reach), 0) as reach, min(l.seen_at) as first_seen,
           mode() within group (order by l.niche) filter (where l.niche is not null) as niche
    from public.shop_ad_links l
    where l.domain = s.domain and l.handle is not null
      and l.seen_at > now() - make_interval(days => p_days)
    group by l.handle
  ) a on true
  where p.shop_id = s.id
    and lower(p.handle) = a.handle
    and (p_domains is null or s.domain = any (p_domains));

  -- Produits qui n'ont plus aucune pub récente : remis à zéro (sortent des listes).
  update public.shop_products p set ads_count = 0, ads_active = 0, winner_score = 0
  from public.shops s
  where p.shop_id = s.id and p.ads_count > 0
    and (p_domains is null or s.domain = any (p_domains))
    and not exists (
      select 1 from public.shop_ad_links l
      where l.domain = s.domain and l.handle = lower(p.handle)
        and l.seen_at > now() - make_interval(days => p_days));

  return v_n;
end;
$fn$;

create or replace function public.catalog_ingest(p_src jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_links integer := 0;
  v_shops integer := 0;
  v_domains text[];
begin
  if p_src is null or jsonb_typeof(p_src) <> 'array' or jsonb_array_length(p_src) = 0 then
    return jsonb_build_object('links', 0, 'new_shops', 0);
  end if;

  with norm as (
    select distinct on (x.ad ->> 'ad_archive_id')
      x.ad ->> 'ad_archive_id' as ad_archive_id,
      lower(regexp_replace(coalesce(x.ad ->> 'landing_domain', ''), '^www\.', '')) as domain,
      lower(nullif(substring(x.ad ->> 'landing_url' from '/products/([A-Za-z0-9%._~-]+)'), '')) as handle,
      x.ad as payload,
      coalesce((x.ad ->> 'is_active')::boolean, true) as is_active,
      nullif(x.ad ->> 'start_date', '')::date as start_date,
      x.ad ->> 'country' as country,
      nullif(x.ad ->> 'reach', '')::bigint as reach,
      x.niche,
      coalesce(x.seen, now()) as seen
    from jsonb_to_recordset(p_src) as x(ad jsonb, niche text, seen timestamptz)
    where coalesce(x.ad ->> 'landing_kind', '') = 'shop'
      and coalesce(x.ad ->> 'ad_archive_id', '') <> ''
    order by x.ad ->> 'ad_archive_id', (x.niche is null), x.seen desc
  ),
  up as (
    insert into public.shop_ad_links as l
      (ad_archive_id, domain, handle, payload, is_active, start_date, country, reach, niche, seen_at)
    select ad_archive_id, domain, handle, payload, is_active, start_date, country, reach, niche, seen
    from norm
    where domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$' and not public.is_non_shop_domain(domain)
    on conflict (ad_archive_id) do update set
      domain = excluded.domain, handle = excluded.handle, payload = excluded.payload,
      is_active = excluded.is_active, start_date = excluded.start_date,
      country = excluded.country, reach = excluded.reach,
      niche = coalesce(excluded.niche, l.niche),
      seen_at = greatest(l.seen_at, excluded.seen_at)
    returning domain
  )
  select count(*), array_agg(distinct domain) into v_links, v_domains from up;

  if v_links = 0 then
    return jsonb_build_object('links', 0, 'new_shops', 0);
  end if;

  insert into public.shops (domain)
  select d from unnest(v_domains) d
  on conflict (domain) do nothing;
  get diagnostics v_shops = row_count;

  perform public.catalog_reaggregate(v_domains);
  return jsonb_build_object('links', v_links, 'new_shops', v_shops);
end;
$fn$;

create or replace function public.catalog_from_searches()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  begin
    perform public.catalog_ingest(coalesce((
      select jsonb_agg(jsonb_build_object('ad', e, 'niche', public.niche_of(n.filters ->> 'q'), 'seen', n.created_at))
      from new_rows n,
           jsonb_array_elements(case jsonb_typeof(n.results) when 'array' then n.results
                                     else coalesce(n.results -> 'ads', '[]'::jsonb) end) e
    ), '[]'::jsonb));
  exception when others then
    raise warning 'catalog_from_searches: %', sqlerrm;
  end;
  return null;
end;
$fn$;

create or replace function public.catalog_from_feed()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  begin
    perform public.catalog_ingest(coalesce((
      select jsonb_agg(jsonb_build_object(
        'ad', n.payload,
        'niche', case n.niche when 'Auto & moto' then 'Automobile' when 'Bien-être' then 'Santé'
                              when 'Montre & tech' then 'High-tech' else n.niche end,
        'seen', n.refreshed_at))
      from new_rows n
    ), '[]'::jsonb));
  exception when others then
    raise warning 'catalog_from_feed: %', sqlerrm;
  end;
  return null;
end;
$fn$;

drop trigger if exists catalog_searches_ins on public.spy_searches;
create trigger catalog_searches_ins after insert on public.spy_searches
  referencing new table as new_rows for each statement execute function public.catalog_from_searches();
drop trigger if exists catalog_searches_upd on public.spy_searches;
create trigger catalog_searches_upd after update on public.spy_searches
  referencing new table as new_rows for each statement execute function public.catalog_from_searches();
drop trigger if exists catalog_feed_ins on public.feed_ads;
create trigger catalog_feed_ins after insert on public.feed_ads
  referencing new table as new_rows for each statement execute function public.catalog_from_feed();
drop trigger if exists catalog_feed_upd on public.feed_ads;
create trigger catalog_feed_upd after update on public.feed_ads
  referencing new table as new_rows for each statement execute function public.catalog_from_feed();

create table if not exists public.trend_rankings (
  kind text not null check (kind in ('product', 'shop', 'ad')),
  zone text not null check (zone in ('all', 'africa', 'europe', 'america')),
  position integer not null,
  item_id text not null,
  score numeric not null default 0,
  payload jsonb,
  computed_at timestamptz not null default now(),
  primary key (kind, zone, position),
  unique (kind, zone, item_id)
);
alter table public.trend_rankings enable row level security;

create or replace function public.replace_trend_rankings(p_kind text, p_zone text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_n integer;
begin
  delete from public.trend_rankings where kind = p_kind and zone = p_zone;
  insert into public.trend_rankings (kind, zone, position, item_id, score, payload)
  select p_kind, p_zone, x.position, x.item_id, coalesce(x.score, 0), x.payload
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(position integer, item_id text, score numeric, payload jsonb);
  get diagnostics v_n = row_count;
  return v_n;
end;
$fn$;

revoke all on function public.catalog_reaggregate(text[], integer) from public, anon, authenticated;
revoke all on function public.catalog_ingest(jsonb) from public, anon, authenticated;
revoke all on function public.replace_trend_rankings(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.catalog_from_searches() from public, anon, authenticated;
revoke all on function public.catalog_from_feed() from public, anon, authenticated;
grant execute on function public.catalog_reaggregate(text[], integer) to service_role;
grant execute on function public.catalog_ingest(jsonb) to service_role;
grant execute on function public.replace_trend_rankings(text, text, jsonb) to service_role;

select public.catalog_ingest(coalesce((
  select jsonb_agg(jsonb_build_object('ad', e, 'niche', public.niche_of(s.filters ->> 'q'), 'seen', s.created_at))
  from public.spy_searches s,
       jsonb_array_elements(case jsonb_typeof(s.results) when 'array' then s.results
                                 else coalesce(s.results -> 'ads', '[]'::jsonb) end) e
  where s.created_at > now() - interval '30 days'
), '[]'::jsonb));

select public.catalog_ingest(coalesce((
  select jsonb_agg(jsonb_build_object(
    'ad', f.payload,
    'niche', case f.niche when 'Auto & moto' then 'Automobile' when 'Bien-être' then 'Santé'
                          when 'Montre & tech' then 'High-tech' else f.niche end,
    'seen', f.refreshed_at))
  from public.feed_ads f
), '[]'::jsonb));

select public.catalog_reaggregate(null);

-- ---------------------------------------------------------------------------
-- 0043 — Catalogue VIVANT : Produits gagnants, Boutiques et Top Trend
-- s'alimentent tout seuls.
--  * catalog_ingest(ads) : indexe des pubs (lien pub → boutique/produit),
--    ajoute les nouvelles boutiques (dédup sur le domaine), recalcule
--    uniquement les boutiques touchées. Rapide (quelques ms par recherche).
--  * Déclencheurs (par instruction) sur spy_searches (recherche Apify d'un
--    user, et mise à jour du miroir Bunny) et sur feed_ads (feed commun) :
--    chaque pub repérée est indexée immédiatement. Une erreur n'empêche
--    jamais l'enregistrement de la recherche (warning seulement).
--  * winner_score (0–100) sur produits et boutiques : pubs actives (60),
--    nombre de pubs (20), nouveauté (10), portée UE (10).
--  * discovered_at : date d'arrivée d'un produit dans les Produits gagnants
--    (tri « nouveautés »).
--  * trend_rankings : classement Top Trend recalculé par /api/cron/trends
--    (plusieurs fois par jour), lu par la page. RLS sans politique : lecture
--    serveur uniquement (le gating par offre reste côté serveur).
--  * Fin du fichier : rattrapage des 30 derniers jours (pubs non indexées
--    depuis l'arrêt du 7 novembre : l'ancien index complet dépassait la
--    limite de 8 s de l'API).
-- ---------------------------------------------------------------------------
