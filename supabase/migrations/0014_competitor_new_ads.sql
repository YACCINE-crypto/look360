-- Compteur de nouvelles pubs détectées depuis la dernière consultation
-- (badge "nouvelle pub" sur la page Surveillance). Incrémenté par le cron,
-- remis à 0 quand l'utilisateur ouvre la page d'analyse du concurrent.
alter table public.competitors_watch
  add column if not exists new_ads_count integer not null default 0;
