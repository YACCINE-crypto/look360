-- Spy v2 — pubs mises de côté (bibliothèque persistante) + colonne média CDN.
-- Les fichiers sont archivés sur Bunny.net (voir lib/mediaStorage) ; ici on ne
-- garde que les métadonnées + les URLs (source Meta qui expire, et CDN stable).
create table public.spy_saved_ads (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  created_at           timestamptz not null default now(),
  ad_archive_id        text,
  page_id              text,
  page_name            text,
  ad_text              text,
  landing_url          text,
  ad_library_url       text,
  start_date           date,
  variants_count       integer,
  reach_estimate       bigint,
  platforms            text[],
  is_active            boolean,
  media_type           text,
  media_source_url     text,     -- lien Meta d'origine (peut expirer)
  media_cdn_url        text,     -- lien Bunny après archivage (affiché en priorité)
  thumbnail_source_url text,
  thumbnail_cdn_url    text,
  media_stored         boolean not null default false,
  score                integer,
  pays_cible           text,
  unique (user_id, ad_archive_id)
);

comment on table public.spy_saved_ads is 'Pubs Spy sauvegardées (Spy v2) — médias archivés sur CDN.';

create index spy_saved_ads_user_idx on public.spy_saved_ads (user_id, created_at desc);

alter table public.spy_saved_ads enable row level security;

create policy "spy_saved_ads_select" on public.spy_saved_ads
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "spy_saved_ads_insert" on public.spy_saved_ads
  for insert with check (user_id = (select auth.uid()));
create policy "spy_saved_ads_update" on public.spy_saved_ads
  for update using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "spy_saved_ads_delete" on public.spy_saved_ads
  for delete using (user_id = (select auth.uid()) or (select public.is_admin()));

grant select, insert, update, delete on public.spy_saved_ads to authenticated;

-- Produit : image archivée sur CDN quand une pub devient produit.
alter table public.produits add column if not exists media_cdn_url text;
