-- 0040 — Catalogue partagé (feed_ads, shops, shop_products) : la lecture
-- DIRECTE par l'API Supabase est réservée aux plans payants effectifs. Le
-- gratuit passe par les pages serveur, qui ne renvoient que l'aperçu
-- (Feed 20, Produits/Boutiques 5). À appliquer EN MÊME TEMPS que le code qui
-- lit le catalogue côté serveur (sinon les pages gratuites seraient vides).
drop policy if exists feed_ads_read on public.feed_ads;
create policy feed_ads_read on public.feed_ads for select to authenticated
  using ((select public.my_plan()) <> 'free');
drop policy if exists shops_read on public.shops;
create policy shops_read on public.shops for select to authenticated
  using ((select public.my_plan()) <> 'free');
drop policy if exists shop_products_read on public.shop_products;
create policy shop_products_read on public.shop_products for select to authenticated
  using ((select public.my_plan()) <> 'free');


-- Plafond de coût caché (units) : marge de 25 % au-dessus des recherches pour
-- les offres payantes, afin que le détail d'une pub (1 appel Apify, compté en
-- units seulement) n'ampute jamais les recherches affichées à l'utilisateur.
update public.plan_limits set monthly_market_search_units = case plan
  when 'free' then 5 when 'starter' then 250 when 'pro' then 500 when 'business' then 750 end;
