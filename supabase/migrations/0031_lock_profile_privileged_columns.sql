-- ============================================================================
-- 0031 — Audit sécurité : rôle et suspension non modifiables par le client.
--
-- Avant : la policy profiles_update (0015) laissait chaque compte modifier
-- TOUTE sa ligne profiles via PostgREST, y compris role = 'superadmin' et
-- suspended = false. N'importe quel compte gratuit devenait superadmin.
--
-- Après :
--  1. Le client ne peut plus écrire que les colonnes éditables (nom, vitrine_share).
--     Plus d'INSERT client (le profil est créé par handle_new_user, definer).
--  2. Trigger de garde SECURITY INVOKER : refuse tout changement de role/suspended
--     fait par anon/authenticated, même si un grant large revenait plus tard.
--     (INVOKER volontaire : en DEFINER, current_user serait le propriétaire et
--      le contrôle ne se déclencherait jamais.) Les RPC admin (definer) et le
--     service_role continuent de fonctionner.
--  3. Un superadmin suspendu perd ses droits admin (is_superadmin exige
--     suspended = false).
--  4. Suspension appliquée en base : policies RESTRICTIVE sur les tables
--     métier, un compte suspendu n'y lit ni n'écrit plus rien.
-- ============================================================================

-- 1) Privilèges colonne par colonne.
revoke insert, update on public.profiles from anon, authenticated;
grant update (nom, vitrine_share) on public.profiles to authenticated;
drop policy if exists profiles_insert on public.profiles;

-- 2) Garde en profondeur.
create or replace function public.guard_profile_privileged_cols()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.suspended is distinct from old.suspended)
     and current_user in ('anon', 'authenticated') then
    raise exception 'forbidden: role/suspended are not user-editable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_privileged_cols() from public, anon, authenticated;
drop trigger if exists profiles_privileged_guard on public.profiles;
create trigger profiles_privileged_guard before update on public.profiles
  for each row execute function public.guard_profile_privileged_cols();

-- 3) Superadmin suspendu = plus superadmin.
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from public.profiles
    where id = (select auth.uid()) and role = 'superadmin' and not suspended);
$function$;
revoke execute on function public.is_superadmin() from public, anon, authenticated;

-- 4) Compte actif (non suspendu). Exécutable par authenticated car évalué
--    dans les policies RLS.
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(
    (select not suspended from public.profiles where id = (select auth.uid())),
    false);
$function$;
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'produits', 'tests', 'competitors_watch', 'spy_saved_ads', 'spy_searches',
    'push_subscriptions', 'winner_agent_config', 'winner_agent_seen', 'winner_daily',
    'feed_ads'
  ] loop
    execute format('drop policy if exists %I on public.%I;', t || '_not_suspended', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select public.is_active_user())) with check ((select public.is_active_user()));',
      t || '_not_suspended', t);
  end loop;
end $$;
