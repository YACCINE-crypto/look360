-- ============================================================================
-- 0029 — Feed commun pré-rempli (pubs gagnantes du jour), PARTAGÉ par tous.
-- Lecture = tout utilisateur connecté (NON restreint par compte).
-- Écriture = service_role uniquement (le cron de refresh ; il bypasse la RLS).
-- Gratuit à parcourir (0 crédit). L'app n'ouvre plus sur un écran vide.
-- ============================================================================
create table if not exists public.feed_ads (
  id                uuid primary key default gen_random_uuid(),
  ad_archive_id     text not null unique,
  page_name         text,
  page_id           text,
  score             int  not null default 0,
  score_label       text,
  jours_actifs      int,                 -- ancienneté (jours de diffusion)
  reach             bigint,
  platforms         text[] not null default '{}',
  country           text,
  variants_count    int not null default 1,
  niche             text,
  media_type        text,                -- video | image | none
  media_cdn_url     text,                -- créative archivée (Bunny), persistante
  thumbnail_cdn_url text,
  ad_library_url    text,
  landing_domain    text,
  payload           jsonb not null default '{}',  -- SpyAd complet (rendu carte)
  created_at        timestamptz not null default now(),
  refreshed_at      timestamptz not null default now()
);

alter table public.feed_ads enable row level security;

-- Lecture : tout utilisateur connecté (feed commun).
drop policy if exists feed_ads_read on public.feed_ads;
create policy feed_ads_read on public.feed_ads
  for select to authenticated using (true);

-- Écriture réservée au service_role (aucune policy write pour anon/authenticated).
revoke all on public.feed_ads from anon, authenticated;
grant select on public.feed_ads to authenticated;

create index if not exists feed_ads_rank_idx on public.feed_ads (score desc, refreshed_at desc);
create index if not exists feed_ads_niche_idx on public.feed_ads (niche);
create index if not exists feed_ads_refreshed_idx on public.feed_ads (refreshed_at desc);
