-- PHASE 1 — Fondation multi-tenant : isolation stricte par propriétaire.
-- Chaque compte ne voit QUE ses données. Plus d'échappatoire "admin voit tout"
-- dans les policies : l'accès super-admin cross-tenant passera par le
-- service_role (panneau admin, phase ultérieure), jamais par ces policies.

-- 1) Rôles : superadmin / owner / member (au lieu de admin / agent).
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'superadmin' where role = 'admin';
update public.profiles set role = 'member' where role = 'agent';
update public.profiles set role = 'owner'
  where role not in ('superadmin', 'owner', 'member');
alter table public.profiles
  add constraint profiles_role_check check (role in ('superadmin', 'owner', 'member'));
alter table public.profiles alter column role set default 'owner';

-- 2) Nouveau compte = OWNER de son propre tenant. On IGNORE tout rôle passé
--    dans les métadonnées (empêche l'auto-élévation en superadmin au signup).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_nom text;
begin
  v_nom := coalesce(new.raw_user_meta_data ->> 'nom',
                    new.raw_user_meta_data ->> 'full_name',
                    split_part(new.email, '@', 1));
  insert into public.profiles (id, nom, role)
  values (new.id, v_nom, 'owner') on conflict (id) do nothing;
  return new;
end;
$function$;

-- 3) Helpers de rôle (usage futur : panneau admin côté service_role/serveur).
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from public.profiles
    where id = (select auth.uid()) and role = 'superadmin');
$function$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $function$ select public.is_superadmin(); $function$;

-- 4) Policies : isolation stricte par propriétaire (owner = auth.uid()).
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists produits_select on public.produits;
drop policy if exists produits_insert on public.produits;
drop policy if exists produits_update on public.produits;
drop policy if exists produits_delete on public.produits;
create policy produits_select on public.produits for select using (soumis_par = (select auth.uid()));
create policy produits_insert on public.produits for insert with check (soumis_par = (select auth.uid()));
create policy produits_update on public.produits for update using (soumis_par = (select auth.uid())) with check (soumis_par = (select auth.uid()));
create policy produits_delete on public.produits for delete using (soumis_par = (select auth.uid()));

drop policy if exists tests_select on public.tests;
drop policy if exists tests_insert on public.tests;
drop policy if exists tests_update on public.tests;
drop policy if exists tests_delete on public.tests;
create policy tests_select on public.tests for select using (exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())));
create policy tests_insert on public.tests for insert with check (exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())));
create policy tests_update on public.tests for update using (exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid()))) with check (exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())));
create policy tests_delete on public.tests for delete using (exists (select 1 from public.produits p where p.id = tests.produit_id and p.soumis_par = (select auth.uid())));

drop policy if exists competitors_watch_select on public.competitors_watch;
drop policy if exists competitors_watch_insert on public.competitors_watch;
drop policy if exists competitors_watch_update on public.competitors_watch;
drop policy if exists competitors_watch_delete on public.competitors_watch;
create policy competitors_watch_select on public.competitors_watch for select using (user_id = (select auth.uid()));
create policy competitors_watch_insert on public.competitors_watch for insert with check (user_id = (select auth.uid()));
create policy competitors_watch_update on public.competitors_watch for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy competitors_watch_delete on public.competitors_watch for delete using (user_id = (select auth.uid()));

drop policy if exists spy_saved_ads_select on public.spy_saved_ads;
drop policy if exists spy_saved_ads_insert on public.spy_saved_ads;
drop policy if exists spy_saved_ads_update on public.spy_saved_ads;
drop policy if exists spy_saved_ads_delete on public.spy_saved_ads;
create policy spy_saved_ads_select on public.spy_saved_ads for select using (user_id = (select auth.uid()));
create policy spy_saved_ads_insert on public.spy_saved_ads for insert with check (user_id = (select auth.uid()));
create policy spy_saved_ads_update on public.spy_saved_ads for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy spy_saved_ads_delete on public.spy_saved_ads for delete using (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_select on public.push_subscriptions;
drop policy if exists push_subscriptions_insert on public.push_subscriptions;
drop policy if exists push_subscriptions_update on public.push_subscriptions;
drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions for select using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert with check (user_id = (select auth.uid()));
create policy push_subscriptions_update on public.push_subscriptions for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete using (user_id = (select auth.uid()));

drop policy if exists wac_select on public.winner_agent_config;
drop policy if exists wac_insert on public.winner_agent_config;
drop policy if exists wac_update on public.winner_agent_config;
drop policy if exists wac_delete on public.winner_agent_config;
create policy wac_select on public.winner_agent_config for select using (user_id = (select auth.uid()));
create policy wac_insert on public.winner_agent_config for insert with check (user_id = (select auth.uid()));
create policy wac_update on public.winner_agent_config for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy wac_delete on public.winner_agent_config for delete using (user_id = (select auth.uid()));

drop policy if exists was_select on public.winner_agent_seen;
drop policy if exists was_insert on public.winner_agent_seen;
drop policy if exists was_delete on public.winner_agent_seen;
create policy was_select on public.winner_agent_seen for select using (user_id = (select auth.uid()));
create policy was_insert on public.winner_agent_seen for insert with check (user_id = (select auth.uid()));
create policy was_delete on public.winner_agent_seen for delete using (user_id = (select auth.uid()));

drop policy if exists wd_select on public.winner_daily;
create policy wd_select on public.winner_daily for select using (user_id = (select auth.uid()));
