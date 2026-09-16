-- ============================================================================
-- Look360 — Schéma initial (§3 du plan technique)
-- Tables : profiles, produits, tests, push_subscriptions
-- + Row Level Security (RLS) : chaque user gère ses données, l'admin voit tout.
-- ============================================================================

-- ============================================================================
-- Table profiles — utilisateurs, liés à Supabase Auth (auth.users)
-- ============================================================================
create table public.profiles (
  id   uuid primary key references auth.users (id) on delete cascade,
  nom  text,
  role text not null default 'agent' check (role in ('admin', 'agent'))
);

comment on table public.profiles is 'Utilisateurs Look360 (admin = patron, agent = commercial).';

-- ----------------------------------------------------------------------------
-- Helper : l'utilisateur courant est-il admin ?
-- SECURITY DEFINER => contourne la RLS, évite la récursion dans les policies
-- de la table profiles. Défini APRÈS profiles (référencée dans le corps).
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

-- Chacun voit/gère son profil ; l'admin voit/gère tout.
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "profiles_delete" on public.profiles
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription.
-- Le PREMIER utilisateur devient 'admin' (le patron), les suivants 'agent'.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_nom  text;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    v_role := 'agent';
  else
    v_role := 'admin';
  end if;

  v_nom := coalesce(
    new.raw_user_meta_data ->> 'nom',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, nom, role)
  values (new.id, v_nom, v_role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Table produits — le cœur : chaque produit trouvé
-- ============================================================================
create table public.produits (
  id                         uuid primary key default gen_random_uuid(),
  created_at                 timestamptz not null default now(),
  nom                        text,
  image_url                  text,
  lien_source                text,
  lien_concurrent            text,
  lien_ad_library            text,
  date_debut_pub_concurrent  date,
  angle_marketing            text,
  emotion_tag                text,
  marche                     text,
  prix_sourcing              numeric,
  poids_kg                   numeric,
  frais_logistiques_kilo     numeric,
  -- Coût livré estimé = prix_sourcing + poids_kg * frais_logistiques_kilo (§5).
  -- Colonne générée : la formule est garantie côté base.
  cout_livre_estime          numeric generated always as (
    coalesce(prix_sourcing, 0) + coalesce(poids_kg, 0) * coalesce(frais_logistiques_kilo, 0)
  ) stored,
  statut                     text not null default 'idee'
                               check (statut in ('idee', 'a_tester', 'en_test', 'valide', 'production', 'abandonne')),
  soumis_par                 uuid default auth.uid() references public.profiles (id) on delete set null,
  statut_revue               text not null default 'soumis'
                               check (statut_revue in ('soumis', 'en_analyse', 'approuve', 'rejete')),
  date_a_travailler          date,
  date_lancement_testing     date,
  notif_envoyee              boolean not null default false,
  notes                      text
);

comment on table public.produits is 'Produits de recherche COD (§3 du plan).';

create index produits_statut_idx                 on public.produits (statut);
create index produits_soumis_par_idx             on public.produits (soumis_par);
create index produits_date_a_travailler_idx      on public.produits (date_a_travailler);
create index produits_date_lancement_testing_idx on public.produits (date_lancement_testing);

alter table public.produits enable row level security;

-- Chacun gère ses produits (soumis_par) ; l'admin voit/gère tout.
create policy "produits_select" on public.produits
  for select using (soumis_par = auth.uid() or public.is_admin());

create policy "produits_insert" on public.produits
  for insert with check (soumis_par = auth.uid() or public.is_admin());

create policy "produits_update" on public.produits
  for update using (soumis_par = auth.uid() or public.is_admin())
  with check (soumis_par = auth.uid() or public.is_admin());

create policy "produits_delete" on public.produits
  for delete using (soumis_par = auth.uid() or public.is_admin());

-- ============================================================================
-- Table tests — résultats de test rattachés à un produit (1 produit → N tests)
-- ============================================================================
create table public.tests (
  id                    uuid primary key default gen_random_uuid(),
  produit_id            uuid not null references public.produits (id) on delete cascade,
  created_at            timestamptz not null default now(),
  marche                text,
  prix_vente_prevu      numeric,
  commandes_recues      integer,
  commandes_confirmees  integer,
  depense_pub           numeric,
  cout_produit_estime   numeric,
  frais_livraison_prevu numeric default 1800,
  verdict               text,
  notes_test            text
);

comment on table public.tests is 'Résultats de test par produit/marché (§3 du plan).';

create index tests_produit_id_idx on public.tests (produit_id);

alter table public.tests enable row level security;

-- Accès via le produit parent : propriétaire du produit ou admin.
create policy "tests_select" on public.tests
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.produits p
      where p.id = tests.produit_id and p.soumis_par = auth.uid()
    )
  );

create policy "tests_insert" on public.tests
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.produits p
      where p.id = tests.produit_id and p.soumis_par = auth.uid()
    )
  );

create policy "tests_update" on public.tests
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.produits p
      where p.id = tests.produit_id and p.soumis_par = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.produits p
      where p.id = tests.produit_id and p.soumis_par = auth.uid()
    )
  );

create policy "tests_delete" on public.tests
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.produits p
      where p.id = tests.produit_id and p.soumis_par = auth.uid()
    )
  );

-- ============================================================================
-- Table push_subscriptions — abonnements Web Push (1 user → N appareils)
-- ============================================================================
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is 'Abonnements Web Push par appareil (§6 du plan).';

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Chacun gère ses propres abonnements ; l'admin peut tout consulter.
create policy "push_subscriptions_select" on public.push_subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

create policy "push_subscriptions_update" on public.push_subscriptions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- Privilèges pour le rôle "authenticated" (la RLS filtre par-dessus).
-- ============================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles           to authenticated;
grant select, insert, update, delete on public.produits           to authenticated;
grant select, insert, update, delete on public.tests              to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
