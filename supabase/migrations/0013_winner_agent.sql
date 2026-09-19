-- Spy v2 §7 — AI Winner Agent : config par utilisateur, anti-doublon, gagnants du jour.

-- Config (1 par utilisateur)
create table public.winner_agent_config (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  active         boolean not null default true,
  keywords       text[] not null default '{}',
  countries      text[] not null default '{}',
  anciennete_min integer not null default 30,
  reach_min      integer not null default 0,
  score_min      integer not null default 60,
  results_max    integer not null default 10,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Anti-doublon : pubs déjà proposées à cet utilisateur
create table public.winner_agent_seen (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  ad_archive_id text not null,
  seen_at       timestamptz not null default now(),
  unique (user_id, ad_archive_id)
);
create index winner_agent_seen_user_idx on public.winner_agent_seen (user_id);

-- Gagnants du jour (payload = pub normalisée)
create table public.winner_daily (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  day           date not null default current_date,
  ad_archive_id text,
  score         integer,
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);
create index winner_daily_user_day_idx on public.winner_daily (user_id, day desc, score desc);

alter table public.winner_agent_config enable row level security;
alter table public.winner_agent_seen enable row level security;
alter table public.winner_daily enable row level security;

-- winner_agent_config
create policy "wac_select" on public.winner_agent_config
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "wac_insert" on public.winner_agent_config
  for insert with check (user_id = (select auth.uid()));
create policy "wac_update" on public.winner_agent_config
  for update using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "wac_delete" on public.winner_agent_config
  for delete using (user_id = (select auth.uid()) or (select public.is_admin()));

-- winner_daily (lecture par le propriétaire ; écriture via service_role/cron)
create policy "wd_select" on public.winner_daily
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));

grant select, insert, update, delete on public.winner_agent_config to authenticated;
grant select on public.winner_daily to authenticated;
