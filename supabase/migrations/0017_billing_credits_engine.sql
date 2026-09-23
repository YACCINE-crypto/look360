-- PHASE 2 — Moteur de crédits + abonnements (sans paiement : GeniusPay = phase 3).
-- Tenant = utilisateur propriétaire (user_id ≡ org_id). Tout est vérifié CÔTÉ
-- SERVEUR : mouvements de crédits via fonctions SECURITY DEFINER appelables
-- uniquement par le service_role. Le client ne peut que LIRE son solde (RLS).

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','starter','pro','business')),
  status text not null default 'active' check (status in ('active','expiring','expired')),
  monthly_credits integer not null default 100,
  pack_credits integer not null default 0,
  credits_balance integer generated always as (monthly_credits + pack_credits) stored,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  has_ever_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select using (user_id = (select auth.uid()));

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('monthly_grant','pack_purchase','consumption','refund','admin_adjust')),
  amount integer not null,
  balance_after integer not null,
  reason text,
  reference text,
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
create index if not exists credit_ledger_user_idx on public.credit_ledger(user_id, created_at desc);
drop policy if exists credit_ledger_select on public.credit_ledger;
create policy credit_ledger_select on public.credit_ledger for select using (user_id = (select auth.uid()));

create or replace function public.plan_monthly_credits(p_plan text)
returns integer language sql immutable as $$
  select case p_plan when 'business' then 6000 when 'pro' then 3000 when 'starter' then 1200 else 100 end;
$$;

create or replace function public.apply_credits(
  p_user uuid, p_delta integer, p_type text, p_reason text default null, p_reference text default null
) returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_monthly integer; v_pack integer; v_take integer; v_from_monthly integer; v_total integer;
begin
  insert into public.subscriptions(user_id) values (p_user) on conflict (user_id) do nothing;
  select monthly_credits, pack_credits into v_monthly, v_pack from public.subscriptions where user_id = p_user for update;
  if p_delta < 0 then
    v_take := -p_delta;
    if (v_monthly + v_pack) < v_take then raise exception 'insufficient_credits' using errcode = 'P0001'; end if;
    v_from_monthly := least(v_monthly, v_take);
    v_monthly := v_monthly - v_from_monthly;
    v_pack := v_pack - (v_take - v_from_monthly);
  elsif p_type = 'pack_purchase' then v_pack := v_pack + p_delta;
  else v_monthly := v_monthly + p_delta;
  end if;
  v_total := v_monthly + v_pack;
  update public.subscriptions set monthly_credits = v_monthly, pack_credits = v_pack, updated_at = now() where user_id = p_user;
  insert into public.credit_ledger(user_id, type, amount, balance_after, reason, reference)
    values (p_user, p_type, p_delta, v_total, p_reason, p_reference);
  return v_total;
end; $$;

create or replace function public.set_plan(p_user uuid, p_plan text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_credits integer; v_total integer; v_pack integer;
begin
  if p_plan not in ('free','starter','pro','business') then raise exception 'invalid_plan'; end if;
  insert into public.subscriptions(user_id) values (p_user) on conflict (user_id) do nothing;
  v_credits := public.plan_monthly_credits(p_plan);
  update public.subscriptions set plan = p_plan, status = 'active', monthly_credits = v_credits,
    current_period_start = now(),
    current_period_end = case when p_plan = 'free' then null else now() + interval '30 days' end,
    updated_at = now()
  where user_id = p_user returning pack_credits into v_pack;
  v_total := v_credits + coalesce(v_pack, 0);
  insert into public.credit_ledger(user_id, type, amount, balance_after, reason)
    values (p_user, 'monthly_grant', v_credits, v_total, 'Offre: ' || p_plan);
  return v_total;
end; $$;

create or replace function public.renew_monthly(p_user uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_plan text; v_credits integer; v_total integer; v_pack integer;
begin
  select plan, pack_credits into v_plan, v_pack from public.subscriptions where user_id = p_user for update;
  if v_plan is null then return null; end if;
  v_credits := public.plan_monthly_credits(v_plan);
  update public.subscriptions set monthly_credits = v_credits, current_period_start = now(),
    current_period_end = case when v_plan = 'free' then null else now() + interval '30 days' end,
    status = 'active', updated_at = now() where user_id = p_user;
  v_total := v_credits + coalesce(v_pack, 0);
  insert into public.credit_ledger(user_id, type, amount, balance_after, reason)
    values (p_user, 'monthly_grant', v_credits, v_total, 'Renouvellement mensuel');
  return v_total;
end; $$;

revoke execute on function public.apply_credits(uuid,integer,text,text,text) from anon, authenticated;
revoke execute on function public.set_plan(uuid,text) from anon, authenticated;
revoke execute on function public.renew_monthly(uuid) from anon, authenticated;

create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.subscriptions(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created after insert on public.profiles
  for each row execute function public.handle_new_profile();

insert into public.subscriptions(user_id) select id from public.profiles on conflict (user_id) do nothing;
update public.subscriptions s set plan='business', monthly_credits=6000,
  current_period_end = now() + interval '30 days', updated_at = now()
  from public.profiles p where p.id = s.user_id and p.role = 'superadmin';
