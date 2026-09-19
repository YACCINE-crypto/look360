-- Cache des recherches Spy (§7) : évite de re-payer Apify pour une recherche
-- identique récente + sert de journal pour plafonner le coût par utilisateur.
-- Accès uniquement via service_role (route serveur) : RLS activée, aucune policy.
create table public.spy_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  cache_key  text not null,
  filters    jsonb,
  url        text,
  results    jsonb not null default '[]'::jsonb,
  raw_count  integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.spy_searches is 'Cache + journal des recherches Spy (garde-fou coût Apify).';

create index spy_searches_key_idx  on public.spy_searches (cache_key, created_at desc);
create index spy_searches_user_idx on public.spy_searches (user_id, created_at desc);

alter table public.spy_searches enable row level security;
-- Aucune policy : la table n'est lue/écrite que par la route serveur (service_role).
