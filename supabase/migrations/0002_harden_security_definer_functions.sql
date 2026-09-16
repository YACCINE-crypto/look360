-- Durcissement : retirer l'accès RPC inutile aux fonctions SECURITY DEFINER.
-- (Suite aux advisors de sécurité Supabase après 0001.)

-- handle_new_user() n'est qu'une fonction de trigger (les triggers s'exécutent
-- sans privilège EXECUTE) => on la retire totalement de l'API REST.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- is_admin() doit rester exécutable par "authenticated" (les policies RLS
-- l'appellent, et elle doit rester SECURITY DEFINER pour éviter la récursion
-- sur profiles) mais pas par "anon" ni exposée publiquement.
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
