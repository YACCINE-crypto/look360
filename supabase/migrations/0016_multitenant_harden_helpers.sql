-- Les helpers de rôle ne sont plus utilisés dans les policies (isolation pure) ;
-- ils ne servent qu'au serveur (service_role). On retire l'accès RPC public.
revoke execute on function public.is_admin() from anon, authenticated;
revoke execute on function public.is_superadmin() from anon, authenticated;

-- spy_searches : cache serveur (service_role uniquement). Policy explicite de
-- lecture propriétaire ; le reste = deny par défaut.
drop policy if exists spy_searches_select on public.spy_searches;
create policy spy_searches_select on public.spy_searches for select
  using (user_id = (select auth.uid()));
