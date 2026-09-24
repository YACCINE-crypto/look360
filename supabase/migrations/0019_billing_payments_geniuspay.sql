-- PHASE 3 — Paiement (GeniusPay) : suivi des paiements, activation d'abonnement,
-- recharges de packs, expiration et relances. TOUT est appliqué CÔTÉ SERVEUR
-- via des fonctions SECURITY DEFINER appelables uniquement par le service_role
-- (les Edge Functions). Le client ne peut que LIRE ses propres paiements (RLS).
--
-- IMPORTANT — UNITÉ DES CRÉDITS : la base stocke l'unité INTERNE (business =
-- 6000/mois, packs 500/1200/3000). L'affichage ×100 est purement front
-- (formatCredits). Les fonctions ci-dessous créditent donc l'unité interne :
-- la marge et le nombre d'actions réelles sont strictement inchangés.

-- ---------------------------------------------------------------------------
-- 1) Table des paiements — clé d'idempotence = (provider, provider_ref).
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'geniuspay',
  provider_ref text not null,            -- notre référence marchande (idempotence)
  provider_txn text,                     -- id de transaction du prestataire (webhook)
  purpose text not null check (purpose in ('subscription','credit_pack')),
  plan text check (plan in ('starter','pro','business')),
  credits integer,                       -- crédits INTERNES à ajouter (pack)
  amount integer not null,               -- montant en FCFA
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending','success','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
alter table public.payments enable row level security;
create index if not exists payments_user_idx on public.payments(user_id, created_at desc);
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) Relances de facturation — anti-doublon (une relance par période/type).
-- ---------------------------------------------------------------------------
create table if not exists public.billing_reminders (
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_end timestamptz not null,
  kind text not null check (kind in ('j7','j3','j0','expired')),
  channel text not null default 'email',
  sent_at timestamptz not null default now(),
  primary key (user_id, period_end, kind, channel)
);
alter table public.billing_reminders enable row level security;
-- (aucune policy : lecture/écriture réservées au service_role qui bypass la RLS)

-- ---------------------------------------------------------------------------
-- 3) Activation d'un abonnement payé (source de vérité = plan_monthly_credits).
--    Passe has_ever_paid=true, plan, période +30j, statut actif, crédits mensuels.
-- ---------------------------------------------------------------------------
create or replace function public.activate_subscription(p_user uuid, p_plan text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_credits integer; v_total integer; v_pack integer;
begin
  if p_plan not in ('starter','pro','business') then
    raise exception 'invalid_plan';
  end if;
  insert into public.subscriptions(user_id) values (p_user) on conflict (user_id) do nothing;
  v_credits := public.plan_monthly_credits(p_plan);
  update public.subscriptions set
    plan = p_plan,
    status = 'active',
    has_ever_paid = true,
    monthly_credits = v_credits,
    current_period_start = now(),
    current_period_end = now() + interval '30 days',
    updated_at = now()
  where user_id = p_user
  returning pack_credits into v_pack;
  v_total := v_credits + coalesce(v_pack, 0);
  insert into public.credit_ledger(user_id, type, amount, balance_after, reason)
    values (p_user, 'monthly_grant', v_credits, v_total, 'Abonnement ' || p_plan);
  return v_total;
end; $$;

-- ---------------------------------------------------------------------------
-- 4) Expiration → retour au gratuit. Les crédits de PACKS (déjà payés) restent,
--    seuls les crédits mensuels retombent au palier gratuit. Accès jamais bloqué.
-- ---------------------------------------------------------------------------
create or replace function public.expire_subscription(p_user uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_credits integer; v_total integer; v_pack integer;
begin
  v_credits := public.plan_monthly_credits('free');
  update public.subscriptions set
    plan = 'free',
    status = 'expired',
    monthly_credits = v_credits,
    current_period_start = now(),
    current_period_end = null,
    updated_at = now()
  where user_id = p_user
  returning pack_credits into v_pack;
  if not found then return null; end if;
  v_total := v_credits + coalesce(v_pack, 0);
  insert into public.credit_ledger(user_id, type, amount, balance_after, reason)
    values (p_user, 'monthly_grant', v_credits, v_total, 'Abonnement expiré → gratuit');
  return v_total;
end; $$;

-- ---------------------------------------------------------------------------
-- 5) Application idempotente d'un paiement réussi (appelée par le webhook).
--    Verrou FOR UPDATE sur la ligne paiement : rejouer la même référence ne
--    double jamais l'effet.
-- ---------------------------------------------------------------------------
create or replace function public.apply_payment_success(
  p_provider text, p_ref text, p_txn text default null
) returns text language plpgsql security definer set search_path to 'public' as $$
declare v_pay public.payments%rowtype;
begin
  select * into v_pay from public.payments
    where provider = p_provider and provider_ref = p_ref
    for update;
  if not found then
    raise exception 'payment_not_found';
  end if;
  if v_pay.status = 'success' then
    return 'duplicate';
  end if;

  if v_pay.purpose = 'subscription' then
    perform public.activate_subscription(v_pay.user_id, v_pay.plan);
  elsif v_pay.purpose = 'credit_pack' then
    perform public.apply_credits(
      v_pay.user_id, v_pay.credits, 'pack_purchase', 'Recharge de crédits', p_ref
    );
  else
    raise exception 'unknown_purpose';
  end if;

  update public.payments set status = 'success', provider_txn = p_txn, updated_at = now()
    where id = v_pay.id;
  return 'applied';
end; $$;

-- ---------------------------------------------------------------------------
-- 6) Verrouillage des EXECUTE — service_role uniquement (comme phase 2).
--    CREATE OR REPLACE re-accorde EXECUTE à PUBLIC : il faut donc révoquer
--    explicitement à PUBLIC, pas seulement à anon/authenticated.
-- ---------------------------------------------------------------------------
revoke execute on function public.activate_subscription(uuid,text) from public, anon, authenticated;
revoke execute on function public.expire_subscription(uuid) from public, anon, authenticated;
revoke execute on function public.apply_payment_success(text,text,text) from public, anon, authenticated;
grant execute on function public.activate_subscription(uuid,text) to service_role;
grant execute on function public.expire_subscription(uuid) to service_role;
grant execute on function public.apply_payment_success(text,text,text) to service_role;
