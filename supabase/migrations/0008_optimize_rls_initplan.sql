-- Optimisation RLS (advisor auth_rls_initplan) : (select auth.uid()) /
-- (select public.is_admin()) évalués une fois par requête, pas par ligne.

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles
  for delete using ((select public.is_admin()));

-- produits
drop policy if exists "produits_select" on public.produits;
create policy "produits_select" on public.produits
  for select using (soumis_par = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "produits_insert" on public.produits;
create policy "produits_insert" on public.produits
  for insert with check (soumis_par = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "produits_update" on public.produits;
create policy "produits_update" on public.produits
  for update using (soumis_par = (select auth.uid()) or (select public.is_admin()))
  with check (soumis_par = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "produits_delete" on public.produits;
create policy "produits_delete" on public.produits
  for delete using (soumis_par = (select auth.uid()) or (select public.is_admin()));

-- tests
drop policy if exists "tests_select" on public.tests;
create policy "tests_select" on public.tests
  for select using ((select public.is_admin())
    or exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())));
drop policy if exists "tests_insert" on public.tests;
create policy "tests_insert" on public.tests
  for insert with check ((select public.is_admin())
    or exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())));
drop policy if exists "tests_update" on public.tests;
create policy "tests_update" on public.tests
  for update using ((select public.is_admin())
    or exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())))
  with check ((select public.is_admin())
    or exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())));
drop policy if exists "tests_delete" on public.tests;
create policy "tests_delete" on public.tests
  for delete using ((select public.is_admin())
    or exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())));

-- push_subscriptions
drop policy if exists "push_subscriptions_select" on public.push_subscriptions;
create policy "push_subscriptions_select" on public.push_subscriptions
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "push_subscriptions_insert" on public.push_subscriptions;
create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert with check (user_id = (select auth.uid()));
drop policy if exists "push_subscriptions_update" on public.push_subscriptions;
create policy "push_subscriptions_update" on public.push_subscriptions
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;
create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete using (user_id = (select auth.uid()) or (select public.is_admin()));
