-- Nouveaux champs sourcing / transit + coût livré recalculé selon le mode.
alter table public.produits
  add column if not exists prix_fournisseur   numeric,
  add column if not exists mode_transit        text not null default 'aerien'
    check (mode_transit in ('aerien', 'maritime')),
  add column if not exists frais_transit_kilo  numeric default 12000,
  add column if not exists cbm                  numeric,
  add column if not exists frais_transit_cbm    numeric;

-- Reprise des données existantes (ancien modèle -> nouveau)
update public.produits
  set prix_fournisseur   = coalesce(prix_fournisseur, prix_sourcing),
      frais_transit_kilo = coalesce(frais_transit_kilo, frais_logistiques_kilo, 12000)
  where prix_fournisseur is null;

-- Coût livré recalculé selon le mode de transit (colonne générée) :
--   Aérien   : prix_fournisseur + poids_kg * frais_transit_kilo
--   Maritime : prix_fournisseur + cbm * frais_transit_cbm
alter table public.produits drop column if exists cout_livre_estime;
alter table public.produits
  add column cout_livre_estime numeric generated always as (
    case
      when mode_transit = 'maritime'
        then coalesce(prix_fournisseur, 0) + coalesce(cbm, 0) * coalesce(frais_transit_cbm, 0)
      else coalesce(prix_fournisseur, 0) + coalesce(poids_kg, 0) * coalesce(frais_transit_kilo, 0)
    end
  ) stored;
