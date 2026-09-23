-- CORRECTIF SÉCURITÉ : CREATE OR REPLACE FUNCTION accorde EXECUTE à PUBLIC,
-- dont héritent anon/authenticated. On révoque de PUBLIC et on n'accorde
-- EXECUTE qu'au service_role (appels serveur uniquement).
revoke execute on function public.apply_credits(uuid,integer,text,text,text) from public;
revoke execute on function public.set_plan(uuid,text) from public;
revoke execute on function public.renew_monthly(uuid) from public;
grant execute on function public.apply_credits(uuid,integer,text,text,text) to service_role;
grant execute on function public.set_plan(uuid,text) to service_role;
grant execute on function public.renew_monthly(uuid) to service_role;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_superadmin() from public;
