-- Surveillance de concurrents (pages Facebook / boutiques repérées dans le Spy).
create table public.competitors_watch (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  page_id        text not null,
  page_name      text,
  domaine        text,
  country        text,
  -- Ad archive ids déjà vus (anti-doublon pour la détection de nouvelles pubs).
  known_ad_ids   text[] not null default '{}',
  last_checked_at timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id, page_id)
);

comment on table public.competitors_watch is 'Concurrents suivis (§ surveillance) — 1 page Facebook par ligne.';

create index competitors_watch_user_id_idx on public.competitors_watch (user_id);

alter table public.competitors_watch enable row level security;

create policy "competitors_watch_select" on public.competitors_watch
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "competitors_watch_insert" on public.competitors_watch
  for insert with check (user_id = (select auth.uid()));
create policy "competitors_watch_update" on public.competitors_watch
  for update using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "competitors_watch_delete" on public.competitors_watch
  for delete using (user_id = (select auth.uid()) or (select public.is_admin()));

grant select, insert, update, delete on public.competitors_watch to authenticated;
