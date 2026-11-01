-- ============================================================================
-- 0033 — Catalogue boutiques (Shopify public) relié aux pubs.
--
-- shops          : une boutique par domaine (détectée depuis les pubs).
-- shop_products  : produits publics (products.json), mis à jour tous les 7 j.
-- shop_ad_links  : pub Meta → domaine (+ handle produit si l'URL est une page
--                  produit). Sert à compter les pubs par produit / boutique.
--
-- Contenu public mutualisé : lecture pour tout utilisateur connecté et actif,
-- écriture réservée au service_role (crawler). Aucune donnée de compte ici.
-- ============================================================================

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  platform text not null default 'unknown' check (platform in ('unknown', 'shopify', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'ok', 'not_shopify', 'blocked', 'error')),
  name text,
  country text,
  currency text,
  theme text,
  product_count integer,
  price_min numeric,
  price_max numeric,
  catalog_type text check (catalog_type in ('mono', 'multi')),
  niche text,
  cod_apps text[] not null default '{}',
  pixels text[] not null default '{}',
  new_products_30d integer,
  discounted_count integer,
  -- Agrégats calculés depuis shop_ad_links (données réelles Meta).
  ads_count integer not null default 0,
  ads_active integer not null default 0,
  ad_countries text[] not null default '{}',
  eu_reach bigint,
  first_ad_date date,
  first_seen timestamptz not null default now(),
  last_crawled timestamptz,
  next_crawl_at timestamptz not null default now(),
  crawl_attempts integer not null default 0,
  last_error text
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  shopify_id bigint,
  handle text not null,
  title text not null,
  product_type text,
  vendor text,
  tags text[] not null default '{}',
  price numeric,
  compare_at_price numeric,
  image_url text,
  images text[] not null default '{}',
  variants_count integer,
  available boolean,
  body_excerpt text,
  position integer,
  created_at_shop timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  ads_count integer not null default 0,
  ads_active integer not null default 0,
  first_ad_date date,
  eu_reach bigint,
  unique (shop_id, handle)
);

create table if not exists public.shop_ad_links (
  ad_archive_id text primary key,
  domain text not null,
  handle text,
  payload jsonb not null,
  is_active boolean not null default true,
  start_date date,
  country text,
  reach bigint,
  seen_at timestamptz not null default now()
);

create index if not exists shops_rank_idx on public.shops (ads_count desc);
create index if not exists shops_crawl_idx on public.shops (next_crawl_at);
create index if not exists shop_products_shop_idx on public.shop_products (shop_id, position);
create index if not exists shop_products_rank_idx on public.shop_products (ads_count desc);
create index if not exists shop_ad_links_domain_idx on public.shop_ad_links (domain, handle);
create index if not exists shop_ad_links_seen_idx on public.shop_ad_links (seen_at desc);

-- Lecture partagée (comme feed_ads), écriture service_role uniquement.
do $$
declare t text;
begin
  foreach t in array array['shops', 'shop_products', 'shop_ad_links'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true);', t || '_read', t);
    execute format('drop policy if exists %I on public.%I;', t || '_not_suspended', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select public.is_active_user())) with check ((select public.is_active_user()));',
      t || '_not_suspended', t);
    execute format('revoke all on public.%I from anon, authenticated;', t);
    execute format('grant select on public.%I to authenticated;', t);
  end loop;
end $$;

-- Domaines qui ne sont jamais des boutiques (on ne les crawle pas).
create or replace function public.is_non_shop_domain(d text)
returns boolean
language sql
immutable
as $$
  select d is null or d = '' or d ~* (
    '(^|\.)(google\.com|apple\.com|facebook\.com|fb\.me|fb\.com|instagram\.com|whatsapp\.com|wa\.me|m\.me|'
    'messenger\.com|youtube\.com|youtu\.be|tiktok\.com|bit\.ly|linktr\.ee|tinyurl\.com|adform\.net|'
    'doubleclick\.net|amazon\.[a-z.]+|ebay\.[a-z.]+|aliexpress\.[a-z]+|temu\.com|shein\.com|'
    'forms\.gle|calendly\.com|typeform\.com|wikipedia\.org|gouv\.fr|onelink\.me|app\.link|'
    'sng\.link|go\.link|lnk\.to|t\.me|telegram\.me|snapchat\.com|pinterest\.[a-z.]+)$'
  );
$$;

-- Indexe les pubs récentes (cache Spy 30 j + feed) → boutiques + liens pub/produit,
-- puis recalcule les agrégats. Service_role uniquement.
create or replace function public.refresh_shop_index(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_links integer;
  v_shops integer;
begin
  with src as (
    select e as ad, s.created_at as seen
    from public.spy_searches s,
         jsonb_array_elements(
           case jsonb_typeof(s.results) when 'array' then s.results
                else coalesce(s.results -> 'ads', '[]'::jsonb) end) e
    where s.created_at > now() - make_interval(days => p_days)
    union all
    select f.payload, f.refreshed_at from public.feed_ads f
  ),
  norm as (
    select distinct on (ad ->> 'ad_archive_id')
      ad ->> 'ad_archive_id' as ad_archive_id,
      lower(regexp_replace(coalesce(ad ->> 'landing_domain', ''), '^www\.', '')) as domain,
      nullif(substring(ad ->> 'landing_url' from '/products/([A-Za-z0-9%._~-]+)'), '') as handle,
      ad as payload,
      coalesce((ad ->> 'is_active')::boolean, true) as is_active,
      nullif(ad ->> 'start_date', '')::date as start_date,
      ad ->> 'country' as country,
      nullif(ad ->> 'reach', '')::bigint as reach,
      seen
    from src
    where coalesce(ad ->> 'landing_kind', '') = 'shop'
      and coalesce(ad ->> 'ad_archive_id', '') <> ''
    order by ad ->> 'ad_archive_id', seen desc
  ),
  up as (
    insert into public.shop_ad_links as l
      (ad_archive_id, domain, handle, payload, is_active, start_date, country, reach, seen_at)
    select ad_archive_id, domain, lower(handle), payload, is_active, start_date, country, reach, seen
    from norm
    where not public.is_non_shop_domain(domain)
    on conflict (ad_archive_id) do update set
      domain = excluded.domain, handle = excluded.handle, payload = excluded.payload,
      is_active = excluded.is_active, start_date = excluded.start_date,
      country = excluded.country, reach = excluded.reach,
      seen_at = greatest(l.seen_at, excluded.seen_at)
    returning 1
  )
  select count(*) into v_links from up;

  insert into public.shops (domain)
  select distinct domain from public.shop_ad_links
  on conflict (domain) do nothing;
  get diagnostics v_shops = row_count;

  -- Agrégats boutique (pubs vues sur la fenêtre).
  update public.shops s set
    ads_count = a.n,
    ads_active = a.n_active,
    ad_countries = a.countries,
    eu_reach = a.reach,
    first_ad_date = a.first_ad
  from (
    select domain,
           count(*) as n,
           count(*) filter (where is_active) as n_active,
           array_remove(array_agg(distinct country), null) as countries,
           nullif(sum(reach), 0) as reach,
           min(start_date) as first_ad
    from public.shop_ad_links
    where seen_at > now() - make_interval(days => p_days)
    group by domain
  ) a
  where a.domain = s.domain;

  -- Agrégats produit (pubs qui mènent à la page produit).
  update public.shop_products p set
    ads_count = a.n,
    ads_active = a.n_active,
    first_ad_date = a.first_ad,
    eu_reach = a.reach
  from (
    select l.domain, l.handle,
           count(*) as n,
           count(*) filter (where l.is_active) as n_active,
           min(l.start_date) as first_ad,
           nullif(sum(l.reach), 0) as reach
    from public.shop_ad_links l
    where l.handle is not null and l.seen_at > now() - make_interval(days => p_days)
    group by l.domain, l.handle
  ) a, public.shops s
  where s.domain = a.domain and p.shop_id = s.id and lower(p.handle) = a.handle;

  return jsonb_build_object('links', v_links, 'new_shops', v_shops);
end;
$$;

revoke all on function public.refresh_shop_index(integer) from public, anon, authenticated;
grant execute on function public.refresh_shop_index(integer) to service_role;
revoke all on function public.is_non_shop_domain(text) from public, anon;
grant execute on function public.is_non_shop_domain(text) to authenticated, service_role;

-- Agrégats pubs → produits d'UNE boutique (appelé par le crawler après mise à jour).
create or replace function public.refresh_shop_product_ads(p_domain text, p_days integer default 30)
returns void
language sql
security definer
set search_path = public
as $$
  update public.shop_products p set
    ads_count = coalesce(a.n, 0),
    ads_active = coalesce(a.n_active, 0),
    first_ad_date = a.first_ad,
    eu_reach = a.reach
  from public.shops s
  left join lateral (
    select l.handle,
           count(*) as n,
           count(*) filter (where l.is_active) as n_active,
           min(l.start_date) as first_ad,
           nullif(sum(l.reach), 0) as reach
    from public.shop_ad_links l
    where l.domain = s.domain and l.handle is not null
      and l.seen_at > now() - make_interval(days => p_days)
    group by l.handle
  ) a on true
  where s.domain = p_domain and p.shop_id = s.id and lower(p.handle) = a.handle;
$$;
revoke all on function public.refresh_shop_product_ads(text, integer) from public, anon, authenticated;
grant execute on function public.refresh_shop_product_ads(text, integer) to service_role;
