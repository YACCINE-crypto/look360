-- Unité des crédits ×100 — UNIFIÉE DANS TOUTES LES COUCHES.
-- Avant : la base stockait l'unité interne (Gratuit 100 · Starter 1 200 · Pro
-- 3 000 · Business 6 000) et l'app multipliait par 100 à l'affichage. Ce double
-- système prêtait à confusion (un paiement créditait 1 200 « au lieu de » 120 000).
-- Désormais la base stocke DIRECTEMENT les valeurs ×100. Les coûts d'actions sont
-- aussi ×100 (recherche 1 000/pays, analyse 2 000) → le nombre d'actions réelles
-- et la marge restent identiques (tout est multiplié par le même facteur).
--
-- Migration de données NON idempotente (à n'exécuter qu'une fois).

-- 1) Défaut de la colonne pour les NOUVEAUX comptes (Gratuit = 10 000).
alter table public.subscriptions alter column monthly_credits set default 10000;

-- 2) Source de vérité des crédits mensuels par offre → valeurs ×100.
create or replace function public.plan_monthly_credits(p_plan text)
returns integer language sql immutable as $$
  select case p_plan
    when 'business' then 600000
    when 'pro' then 300000
    when 'starter' then 120000
    else 10000 end;
$$;

-- 3) Backfill des soldes existants ×100 (credits_balance est généré → recalculé).
update public.subscriptions set
  monthly_credits = monthly_credits * 100,
  pack_credits = pack_credits * 100,
  updated_at = now();

-- 4) Backfill de l'historique du grand livre ×100 (cohérence d'affichage).
update public.credit_ledger set
  amount = amount * 100,
  balance_after = balance_after * 100;
