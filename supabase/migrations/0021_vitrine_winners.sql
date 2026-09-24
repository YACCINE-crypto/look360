-- ============================================================================
-- 0021 — Vitrine communautaire des winners validés (offre Business).
-- 100% ANONYMISÉE : jamais d'user_id, jamais de nom de produit. On ne renvoie
-- que des agrégats (catégorie, pays, marge %, closing %). La RLS empêche déjà
-- de lire les lignes des autres ; l'accès inter-comptes anonymisé passe par
-- une fonction SECURITY DEFINER dont la SORTIE ne contient aucune identité.
-- ============================================================================

-- Préférence de partage (opt-out), activée par défaut.
alter table public.profiles
  add column if not exists vitrine_share boolean not null default true;

comment on column public.profiles.vitrine_share is
  'Partage anonyme des tests validés à la vitrine communautaire (opt-out, défaut true).';

-- Fonction : winners validés d'AUTRES commerçants, agrégés et anonymisés.
-- Filtres : statut ''valide'' + dernier test >= 10 commandes reçues + partage
-- activé côté propriétaire + jamais les produits de l'appelant + appelant Business.
create or replace function public.vitrine_winners()
returns table (
  categorie    text,
  marche       text,
  marge_pct    int,
  closing_pct  int,
  validated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (select auth.uid() as uid),
  latest as (
    -- dernier test par produit
    select distinct on (t.produit_id)
      t.produit_id,
      t.prix_vente_prevu,
      t.commandes_recues,
      t.commandes_confirmees,
      t.depense_pub,
      t.cout_produit_estime,
      t.frais_livraison_prevu
    from public.tests t
    order by t.produit_id, t.created_at desc
  )
  select
    p.categorie,
    p.marche,
    round(
      ((coalesce(l.prix_vente_prevu, 0) - coalesce(l.cout_produit_estime, 0) - coalesce(l.frais_livraison_prevu, 0))
        * coalesce(l.commandes_confirmees, 0) - coalesce(l.depense_pub, 0))
      / nullif(coalesce(l.prix_vente_prevu, 0) * coalesce(l.commandes_confirmees, 0), 0) * 100
    )::int as marge_pct,
    round(
      coalesce(l.commandes_confirmees, 0)::numeric / nullif(l.commandes_recues, 0) * 100
    )::int as closing_pct,
    p.created_at as validated_at
  from public.produits p
  join latest l on l.produit_id = p.id
  join public.profiles pr on pr.id = p.soumis_par
  where p.statut = 'valide'
    and coalesce(l.commandes_recues, 0) >= 10
    and pr.vitrine_share = true
    and p.soumis_par is distinct from (select uid from me)
    and exists (
      select 1 from public.subscriptions s
      where s.user_id = (select uid from me) and s.plan = 'business'
    )
  order by p.created_at desc
  limit 60;
$$;

-- Un CREATE OR REPLACE re-donne EXECUTE à PUBLIC : on révoque puis on ne
-- l'accorde qu'à authenticated (jamais anon).
revoke all on function public.vitrine_winners() from public, anon, authenticated;
grant execute on function public.vitrine_winners() to authenticated;
