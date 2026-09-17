-- Index sur le marché (filtre de la page Recherche).
create index if not exists produits_marche_idx on public.produits (marche);
