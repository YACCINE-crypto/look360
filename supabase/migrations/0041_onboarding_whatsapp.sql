-- 0041 — Onboarding (1re connexion) + préférences du feed + WhatsApp opt-in.
--
-- profiles :
--   onboarding_done_at  : date à laquelle l'onboarding a été vu (terminé ou passé).
--                         NULL = à afficher. Les comptes existants sont marqués « vu ».
--   pref_niches / pref_markets : personnalisation du feed (niches, pays).
--   whatsapp_number     : numéro au format international (+225…), facultatif.
--   whatsapp_optin      : consentement EXPLICITE aux alertes WhatsApp (faux par défaut).
--   whatsapp_optin_at   : date du dernier consentement (preuve), NULL si retiré.
-- Règle : pas de consentement sans numéro.

alter table public.profiles
  add column if not exists onboarding_done_at timestamptz,
  add column if not exists pref_niches text[] not null default '{}',
  add column if not exists pref_markets text[] not null default '{}',
  add column if not exists whatsapp_number text,
  add column if not exists whatsapp_optin boolean not null default false,
  add column if not exists whatsapp_optin_at timestamptz;

alter table public.profiles drop constraint if exists profiles_whatsapp_number_format;
alter table public.profiles add constraint profiles_whatsapp_number_format
  check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$');

alter table public.profiles drop constraint if exists profiles_whatsapp_optin_needs_number;
alter table public.profiles add constraint profiles_whatsapp_optin_needs_number
  check (not whatsapp_optin or whatsapp_number is not null);

alter table public.profiles drop constraint if exists profiles_prefs_size;
alter table public.profiles add constraint profiles_prefs_size
  check (cardinality(pref_niches) <= 12 and cardinality(pref_markets) <= 20);

-- Comptes déjà inscrits : pas d'onboarding a posteriori.
update public.profiles set onboarding_done_at = now() where onboarding_done_at is null;

-- L'utilisateur modifie SES préférences (RLS : sa propre ligne). Les colonnes
-- privilégiées (role, suspended) restent verrouillées (0031).
grant update (onboarding_done_at, pref_niches, pref_markets, whatsapp_number, whatsapp_optin, whatsapp_optin_at)
  on public.profiles to authenticated;
