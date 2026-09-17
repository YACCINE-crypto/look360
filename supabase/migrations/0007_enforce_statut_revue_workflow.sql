-- Verrouille le workflow de revue : un agent ne peut que "soumettre" ;
-- seul l'admin peut mettre en analyse / approuver / rejeter.
create or replace function public.enforce_statut_revue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.statut_revue := 'soumis';
    end if;
    return new;
  end if;

  if new.statut_revue is distinct from old.statut_revue
     and new.statut_revue <> 'soumis'
     and not public.is_admin() then
    raise exception 'Seul un admin peut valider, rejeter ou mettre en analyse une soumission';
  end if;

  return new;
end;
$$;

drop trigger if exists produits_statut_revue_guard on public.produits;
create trigger produits_statut_revue_guard
  before insert or update on public.produits
  for each row execute function public.enforce_statut_revue();
