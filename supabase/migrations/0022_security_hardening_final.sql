-- ============================================================================
-- 0022 — Durcissement sécurité final (STEP 10).
-- Corrige les avertissements des advisors Supabase :
--  1. Fonctions de trigger SECURITY DEFINER exposées en RPC (anon/authenticated).
--     Elles ne sont JAMAIS appelées via l'API : on révoque tout EXECUTE.
--     (Les triggers continuent de fonctionner — l'exécution d'un trigger ne
--      dépend pas du privilège EXECUTE du rôle appelant.)
--  2. search_path mutable sur plan_monthly_credits → figé sur public.
-- ============================================================================

-- 1. Fonctions de trigger : plus aucun accès RPC.
revoke all on function public.handle_new_profile() from public, anon, authenticated;
revoke all on function public.enforce_statut_revue() from public, anon, authenticated;

-- 2. search_path figé (évite le détournement via search_path mutable).
alter function public.plan_monthly_credits(p_plan text) set search_path = public;
