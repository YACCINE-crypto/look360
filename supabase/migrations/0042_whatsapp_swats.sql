create table if not exists public.whatsapp_instance (
  id              text primary key,             -- id d'instance SWATS
  name            text not null default 'look360-alerts',
  status          text not null default 'created', -- created | qr | connecting | connected | disconnected
  phone           text,                          -- numéro connecté (si renvoyé par l'API)
  status_at       timestamptz not null default now(),
  last_error      text,
  last_admin_alert_at timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.whatsapp_instance enable row level security;
revoke all on public.whatsapp_instance from anon, authenticated;

create table if not exists public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  event_key       text not null,                 -- ex. winners:2026-11-06
  kind            text not null,                 -- winners | subscription | payment | system
  title           text not null,
  body            text not null,
  image_url       text,                          -- URL Bunny (jamais Meta)
  link            text,
  whatsapp_status text not null default 'pending'
                  check (whatsapp_status in ('pending','queued','sending','sent','skipped','failed')),
  whatsapp_attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  whatsapp_error  text,
  sent_at         timestamptz,
  fallback_at     timestamptz,                   -- e-mail + push envoyés
  fallback_reason text,
  created_at      timestamptz not null default now(),
  unique (user_id, event_key)                    -- idempotence : jamais 2 fois la même alerte
);
create index if not exists notification_deliveries_queue
  on public.notification_deliveries (next_attempt_at) where whatsapp_status = 'queued';
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;
grant select on public.notification_deliveries to authenticated;
drop policy if exists notification_deliveries_own on public.notification_deliveries;
create policy notification_deliveries_own on public.notification_deliveries
  for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.whatsapp_daily_usage (
  day   date primary key,
  sent  int not null default 0
);
alter table public.whatsapp_daily_usage enable row level security;
revoke all on public.whatsapp_daily_usage from anon, authenticated;

create table if not exists public.swats_webhook_events (
  id          text primary key,
  received_at timestamptz not null default now()
);
alter table public.swats_webhook_events enable row level security;
revoke all on public.swats_webhook_events from anon, authenticated;

-- Compteur d'envois du jour (plafond quotidien du plan SWATS), atomique.
create or replace function public.whatsapp_count_send(p_limit int)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v int;
begin
  insert into public.whatsapp_daily_usage(day) values (current_date) on conflict (day) do nothing;
  update public.whatsapp_daily_usage set sent = sent + 1
    where day = current_date and sent < p_limit returning sent into v;
  return v is not null;
end; $$;
revoke all on function public.whatsapp_count_send(int) from public, anon, authenticated;
grant execute on function public.whatsapp_count_send(int) to service_role;

-- 0042 (notes) — Alertes WhatsApp via SWATS (API non officielle, guardrails).
--   whatsapp_instance       : l'instance Look360 (1 ligne) + statut en cache (webhook connection.update).
--   notification_deliveries : file d'envoi + suivi + idempotence (clé unique user + événement).
--                             L'utilisateur ne LIT que ses propres alertes (futur centre de notifs).
--   whatsapp_daily_usage    : envois du jour (quota SWATS, ex. 500/jour en gratuit).
--   swats_webhook_events    : déduplication des webhooks (non signés).
-- Tout est écrit côté serveur (service_role) ; aucun secret en base.
