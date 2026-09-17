-- Type d'approvisionnement : "import" (Chine, prix fournisseur + transit) ou
-- "local" (achat local, un seul prix, aucun frais de transit).
alter table public.produits
  add column if not exists type_approvisionnement text not null default 'import'
    check (type_approvisionnement in ('import', 'local')),
  add column if not exists prix_achat_local numeric;

-- Coût livré recalculé selon le type d'appro puis le mode de transit :
--   Local    : prix_achat_local
--   Maritime : prix_fournisseur + cbm * frais_transit_cbm
--   Aérien   : prix_fournisseur + poids_kg * frais_transit_kilo
alter table public.produits drop column if exists cout_livre_estime;
alter table public.produits
  add column cout_livre_estime numeric generated always as (
    case
      when type_approvisionnement = 'local'
        then coalesce(prix_achat_local, 0)
      when mode_transit = 'maritime'
        then coalesce(prix_fournisseur, 0) + coalesce(cbm, 0) * coalesce(frais_transit_cbm, 0)
      else coalesce(prix_fournisseur, 0) + coalesce(poids_kg, 0) * coalesce(frais_transit_kilo, 0)
    end
  ) stored;
