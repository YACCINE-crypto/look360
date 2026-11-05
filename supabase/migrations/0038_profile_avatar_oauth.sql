-- ============================================================================
-- 0038 — Connexion Google : photo de profil + nom Google dans le profil.
-- Le trigger on_auth_user_created couvre déjà TOUS les fournisseurs (email,
-- Google…) : profil 'owner' puis abonnement 'free' (trigger on_profile_created).
-- On ajoute la lecture de `name` et de la photo (`avatar_url` / `picture`).
-- ============================================================================
alter table public.profiles add column if not exists avatar_url text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text;
  v_avatar text;
begin
  v_nom := coalesce(
    nullif(new.raw_user_meta_data ->> 'nom', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );
  v_avatar := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );
  if v_avatar is not null and v_avatar !~ '^https://' then
    v_avatar := null;
  end if;
  insert into public.profiles (id, nom, role, avatar_url)
  values (new.id, left(v_nom, 120), 'owner', left(v_avatar, 500))
  on conflict (id) do nothing;
  return new;
end;
$$;
