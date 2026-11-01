-- ============================================================================
-- 0035 — Historique des pubs des concurrents suivis (page Surveillance).
-- Alimenté par le cron quotidien /api/cron/competitors (aucun appel Apify en
-- plus : on garde ce que la vérification existante récupère déjà).
--  - first_seen : 1re fois qu'on voit la pub → fil « nouvelles pubs » ;
--  - last_seen  : dernière vérification où elle était active → une pub qui
--    n'est plus vue est « coupée » ; coupée en < 7 jours = flop probable ;
--  - start_date : date de lancement Meta → active depuis 30 j+ = gagnante probable.
--  - baseline   : vue lors de la toute 1re vérification (pas une « nouvelle » pub).
-- Lecture : seulement par les utilisateurs qui suivent cette page.
-- ============================================================================

create table if not exists public.competitor_ads (
  page_id text not null,
  ad_archive_id text not null,
  payload jsonb not null,
  start_date date,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  baseline boolean not null default false,
  primary key (page_id, ad_archive_id)
);
create index if not exists competitor_ads_seen_idx on public.competitor_ads (page_id, first_seen desc);

alter table public.competitor_ads enable row level security;
revoke all on public.competitor_ads from anon, authenticated;
grant select on public.competitor_ads to authenticated;

drop policy if exists competitor_ads_read on public.competitor_ads;
create policy competitor_ads_read on public.competitor_ads
  for select to authenticated
  using (exists (
    select 1 from public.competitors_watch w
    where w.page_id = competitor_ads.page_id and w.user_id = (select auth.uid())
  ));

drop policy if exists competitor_ads_not_suspended on public.competitor_ads;
create policy competitor_ads_not_suspended on public.competitor_ads
  as restrictive for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

-- Reprise de l'historique déjà disponible : pubs des analyses en cache des
-- pages suivies (marquées baseline, pour ne pas les compter comme nouvelles).
insert into public.competitor_ads (page_id, ad_archive_id, payload, start_date, first_seen, last_seen, baseline)
select distinct on (s.filters ->> 'pageId', e ->> 'ad_archive_id')
  s.filters ->> 'pageId', e ->> 'ad_archive_id', e,
  nullif(e ->> 'start_date', '')::date, s.created_at, s.created_at, true
from public.spy_searches s,
     jsonb_array_elements(case jsonb_typeof(s.results) when 'array' then s.results
          else coalesce(s.results -> 'ads', '[]'::jsonb) end) e
where s.filters ->> 'pageId' in (select page_id from public.competitors_watch)
  and coalesce(e ->> 'ad_archive_id', '') <> ''
order by s.filters ->> 'pageId', e ->> 'ad_archive_id', s.created_at desc
on conflict (page_id, ad_archive_id) do nothing;
