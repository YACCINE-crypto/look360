-- Ajoute la catégorie produit (présente dans le design "Nouveau produit").
alter table public.produits add column if not exists categorie text;
