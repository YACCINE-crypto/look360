create table if not exists public.referral_settings (
  id smallint primary key default 1 check (id = 1),
  commission_type text not null default 'percent' check (commission_type in ('percent', 'fixed')),
  rate_pct numeric(5,2) not null default 30 check (rate_pct >= 0 and rate_pct <= 100),
  fixed_amount integer not null default 0 check (fixed_amount >= 0),
  months integer not null default 2 check (months between 0 and 36),
  attribution_days integer not null default 30 check (attribution_days between 1 and 365),
  min_payout integer not null default 5000 check (min_payout >= 0),
  updated_at timestamptz not null default now()
);
insert into public.referral_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referral_clicks (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  visitor text not null,
  created_at timestamptz not null default now()
);
create index if not exists referral_clicks_referrer_idx on public.referral_clicks (referrer_id, created_at desc);
create unique index if not exists referral_clicks_daily_uniq on public.referral_clicks (referrer_id, visitor, ((created_at at time zone 'UTC')::date));

create table if not exists public.referrals (
  referee_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  clicked_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (referee_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referee_id uuid not null references auth.users (id) on delete cascade,
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  month_index integer not null,
  base_amount integer not null,
  commission_type text not null,
  rate_pct numeric(5,2),
  amount integer not null check (amount >= 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text
);
create index if not exists referral_commissions_referrer_idx on public.referral_commissions (referrer_id, created_at desc);
create index if not exists referral_commissions_referee_idx on public.referral_commissions (referee_id);

create table if not exists public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null check (method in ('orange', 'mtn', 'moov', 'wave')),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users (id)
);
create index if not exists referral_payouts_referrer_idx on public.referral_payouts (referrer_id, created_at desc);
create unique index if not exists referral_payouts_one_open on public.referral_payouts (referrer_id) where status = 'requested';

alter table public.referral_settings enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_clicks enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;
alter table public.referral_payouts enable row level security;

create or replace function public.referral_balance(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with c as (
    select coalesce(sum(amount) filter (where status = 'confirmed'), 0) as earned,
           coalesce(sum(amount) filter (where status = 'cancelled'), 0) as cancelled
    from public.referral_commissions where referrer_id = p_user
  ), p as (
    select coalesce(sum(amount) filter (where status = 'paid'), 0) as paid,
           coalesce(sum(amount) filter (where status = 'requested'), 0) as requested
    from public.referral_payouts where referrer_id = p_user
  )
  select jsonb_build_object(
    'earned', c.earned, 'cancelled', c.cancelled, 'paid', p.paid, 'requested', p.requested,
    'available', greatest(c.earned - p.paid - p.requested, 0))
  from c, p;
$fn$;

create or replace function public.referral_ensure_code(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i integer;
begin
  select code into v_code from public.referral_codes where user_id = p_user;
  if v_code is not null then return v_code; end if;
  for attempt in 1..20 loop
    v_code := '';
    for i in 1..7 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    begin
      insert into public.referral_codes (user_id, code) values (p_user, v_code);
      return v_code;
    exception when unique_violation then
      select code into v_code from public.referral_codes where user_id = p_user;
      if v_code is not null then return v_code; end if;
    end;
  end loop;
  raise exception 'referral_code_generation_failed';
end;
$fn$;

create or replace function public.referral_log_click(p_code text, p_visitor text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_referrer uuid;
begin
  select user_id into v_referrer from public.referral_codes where code = upper(p_code);
  if v_referrer is null then return false; end if;
  if p_visitor !~ '^[A-Za-z0-9_-]{8,64}$' then return true; end if;
  insert into public.referral_clicks (referrer_id, visitor) values (v_referrer, p_visitor)
  on conflict do nothing;
  return true;
end;
$fn$;

create or replace function public.claim_referral(p_code text, p_clicked_at timestamptz)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_created timestamptz;
  v_days integer;
begin
  if v_uid is null then return 'not_authenticated'; end if;
  if exists (select 1 from public.referrals where referee_id = v_uid) then return 'already_attributed'; end if;
  select user_id into v_referrer from public.referral_codes where code = upper(coalesce(p_code, ''));
  if v_referrer is null then return 'unknown_code'; end if;
  if v_referrer = v_uid then return 'self_referral'; end if;
  select attribution_days into v_days from public.referral_settings where id = 1;
  select created_at into v_created from auth.users where id = v_uid;
  if p_clicked_at is null or p_clicked_at > now() + interval '5 minutes' then return 'invalid_click'; end if;
  if p_clicked_at < now() - make_interval(days => v_days) then return 'expired'; end if;
  if v_created < p_clicked_at - interval '10 minutes' then return 'existing_account'; end if;
  if v_created > p_clicked_at + make_interval(days => v_days) then return 'expired'; end if;
  insert into public.referrals (referee_id, referrer_id, code, clicked_at)
  values (v_uid, v_referrer, upper(p_code), p_clicked_at)
  on conflict (referee_id) do nothing;
  return 'attributed';
end;
$fn$;

create or replace function public.referral_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ref public.referrals%rowtype;
  v_set public.referral_settings%rowtype;
  v_index integer;
  v_amount integer;
begin
  if new.purpose is distinct from 'subscription' then return null; end if;

  if new.status = 'success' and (tg_op = 'INSERT' or old.status is distinct from 'success') then
    select * into v_ref from public.referrals where referee_id = new.user_id;
    if not found or v_ref.referrer_id = new.user_id then return null; end if;
    if v_ref.created_at > coalesce(new.updated_at, now()) + interval '1 minute' then return null; end if;
    select * into v_set from public.referral_settings where id = 1;
    perform pg_advisory_xact_lock(hashtext('referral:' || new.user_id::text));
    select count(*) + 1 into v_index from public.referral_commissions where referee_id = new.user_id;
    if v_index > v_set.months then return null; end if;
    v_amount := case v_set.commission_type
      when 'fixed' then v_set.fixed_amount
      else round(coalesce(new.amount, 0) * v_set.rate_pct / 100.0)::integer end;
    insert into public.referral_commissions
      (referrer_id, referee_id, payment_id, month_index, base_amount, commission_type, rate_pct, amount)
    values (v_ref.referrer_id, new.user_id, new.id, v_index, coalesce(new.amount, 0), v_set.commission_type,
            case when v_set.commission_type = 'percent' then v_set.rate_pct end, greatest(v_amount, 0))
    on conflict (payment_id) do nothing;

  elsif tg_op = 'UPDATE' and old.status = 'success' and new.status is distinct from 'success' then
    update public.referral_commissions
       set status = 'cancelled', cancelled_at = now(), cancel_reason = 'payment_' || coalesce(new.status, 'changed')
     where payment_id = new.id and status = 'confirmed';
  end if;
  return null;
exception when others then
  raise warning 'referral_on_payment: %', sqlerrm;
  return null;
end;
$fn$;

drop trigger if exists referral_payment_ins on public.payments;
create trigger referral_payment_ins after insert on public.payments
  for each row execute function public.referral_on_payment();
drop trigger if exists referral_payment_upd on public.payments;
create trigger referral_payment_upd after update of status on public.payments
  for each row execute function public.referral_on_payment();

create or replace function public.my_referral_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_set public.referral_settings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_code := public.referral_ensure_code(v_uid);
  select * into v_set from public.referral_settings where id = 1;
  return jsonb_build_object(
    'code', v_code,
    'settings', jsonb_build_object('commission_type', v_set.commission_type, 'rate_pct', v_set.rate_pct,
      'fixed_amount', v_set.fixed_amount, 'months', v_set.months, 'attribution_days', v_set.attribution_days,
      'min_payout', v_set.min_payout),
    'clicks', (select count(*) from public.referral_clicks where referrer_id = v_uid),
    'signups', (select count(*) from public.referrals where referrer_id = v_uid),
    'converted', (select count(distinct referee_id) from public.referral_commissions where referrer_id = v_uid and status = 'confirmed'),
    'balance', public.referral_balance(v_uid),
    'open_payout', (select to_jsonb(x) from (select id, amount, method, phone, created_at from public.referral_payouts
                    where referrer_id = v_uid and status = 'requested') x),
    'commissions', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select c.id, c.created_at, c.month_index, c.base_amount, c.amount, c.status, c.cancel_reason,
               left(coalesce(nullif(p.nom, ''), 'Filleul'), 1) || '•••' as referee
        from public.referral_commissions c left join public.profiles p on p.id = c.referee_id
        where c.referrer_id = v_uid order by c.created_at desc limit 100) x), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select id, created_at, amount, method, status, processed_at
        from public.referral_payouts where referrer_id = v_uid order by created_at desc limit 50) x), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.request_referral_payout(p_method text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_min integer;
  v_available integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_method not in ('orange', 'mtn', 'moov', 'wave') then return jsonb_build_object('ok', false, 'error', 'method'); end if;
  if coalesce(p_phone, '') !~ '^\+[1-9][0-9]{7,14}$' then return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  perform pg_advisory_xact_lock(hashtext('payout:' || v_uid::text));
  if exists (select 1 from public.referral_payouts where referrer_id = v_uid and status = 'requested') then
    return jsonb_build_object('ok', false, 'error', 'already_requested');
  end if;
  select min_payout into v_min from public.referral_settings where id = 1;
  v_available := (public.referral_balance(v_uid) ->> 'available')::integer;
  if v_available < v_min then
    return jsonb_build_object('ok', false, 'error', 'below_minimum', 'available', v_available, 'min', v_min);
  end if;
  insert into public.referral_payouts (referrer_id, amount, method, phone)
  values (v_uid, v_available, p_method, p_phone) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'amount', v_available);
end;
$fn$;

create or replace function public.admin_referral_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'settings', (select to_jsonb(s) from public.referral_settings s where id = 1),
    'affiliates', coalesce((select jsonb_agg(x order by x.earned desc, x.signups desc) from (
        select rc.user_id, rc.code, p.nom, u.email,
               (select count(*) from public.referral_clicks k where k.referrer_id = rc.user_id) as clicks,
               (select count(*) from public.referrals r where r.referrer_id = rc.user_id) as signups,
               (select count(distinct c.referee_id) from public.referral_commissions c where c.referrer_id = rc.user_id and c.status = 'confirmed') as converted,
               (b ->> 'earned')::int as earned, (b ->> 'paid')::int as paid,
               (b ->> 'requested')::int as requested, (b ->> 'available')::int as available
        from public.referral_codes rc
        join auth.users u on u.id = rc.user_id
        left join public.profiles p on p.id = rc.user_id
        cross join lateral public.referral_balance(rc.user_id) b
        where exists (select 1 from public.referrals r where r.referrer_id = rc.user_id)
           or exists (select 1 from public.referral_clicks k where k.referrer_id = rc.user_id)
        limit 500) x), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(x order by (x.status = 'requested') desc, x.created_at desc) from (
        select po.id, po.created_at, po.amount, po.method, po.phone, po.status, po.admin_note, po.processed_at,
               rc.code, p.nom, u.email
        from public.referral_payouts po
        join auth.users u on u.id = po.referrer_id
        left join public.profiles p on p.id = po.referrer_id
        left join public.referral_codes rc on rc.user_id = po.referrer_id
        order by po.created_at desc limit 200) x), '[]'::jsonb),
    'commissions', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select c.id, c.created_at, c.month_index, c.base_amount, c.amount, c.status, c.cancel_reason,
               rc.code as referrer_code, ur.email as referrer_email, ue.email as referee_email
        from public.referral_commissions c
        join auth.users ur on ur.id = c.referrer_id
        join auth.users ue on ue.id = c.referee_id
        left join public.referral_codes rc on rc.user_id = c.referrer_id
        order by c.created_at desc limit 200) x), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.admin_process_payout(p_id uuid, p_status text, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cur text;
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  if p_status not in ('paid', 'rejected') then raise exception 'invalid_status'; end if;
  select status into v_cur from public.referral_payouts where id = p_id for update;
  if v_cur is null then return 'not_found'; end if;
  if v_cur <> 'requested' then return 'already_processed'; end if;
  update public.referral_payouts
     set status = p_status, admin_note = left(p_note, 300), processed_at = now(), processed_by = auth.uid()
   where id = p_id;
  return p_status;
end;
$fn$;

create or replace function public.admin_update_referral_settings(
  p_commission_type text, p_rate_pct numeric, p_fixed_amount integer, p_months integer,
  p_attribution_days integer, p_min_payout integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  update public.referral_settings set
    commission_type = p_commission_type, rate_pct = p_rate_pct, fixed_amount = p_fixed_amount,
    months = p_months, attribution_days = p_attribution_days, min_payout = p_min_payout, updated_at = now()
  where id = 1;
  return (select to_jsonb(s) from public.referral_settings s where id = 1);
end;
$fn$;

revoke all on function public.referral_balance(uuid) from public, anon, authenticated;
revoke all on function public.referral_ensure_code(uuid) from public, anon, authenticated;
revoke all on function public.referral_on_payment() from public, anon, authenticated;
revoke all on function public.referral_log_click(text, text) from public, anon, authenticated;
revoke all on function public.claim_referral(text, timestamptz) from public, anon;
revoke all on function public.my_referral_dashboard() from public, anon;
revoke all on function public.request_referral_payout(text, text) from public, anon;
revoke all on function public.admin_referral_overview() from public, anon;
revoke all on function public.admin_process_payout(uuid, text, text) from public, anon;
revoke all on function public.admin_update_referral_settings(text, numeric, integer, integer, integer, integer) from public, anon;
grant execute on function public.referral_log_click(text, text) to service_role;
grant execute on function public.claim_referral(text, timestamptz) to authenticated;
grant execute on function public.my_referral_dashboard() to authenticated;
grant execute on function public.request_referral_payout(text, text) to authenticated;
grant execute on function public.admin_referral_overview() to authenticated;
grant execute on function public.admin_process_payout(uuid, text, text) to authenticated;
grant execute on function public.admin_update_referral_settings(text, numeric, integer, integer, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 0044 — Parrainage v1.
--  referral_settings (1 ligne) : type (percent | fixed), taux (30 %), montant
--    fixe, nombre de paiements commissionnés (2), validité du clic (30 j),
--    seuil de retrait (5 000 F). Modifiable par admin_update_referral_settings.
--  referral_codes : code unique par user (7 caractères, sans 0/O/1/I/L).
--  referral_clicks : 1 clic compté par visiteur et par jour.
--  referrals : UNE attribution par filleul (clé = filleul), jamais soi-même,
--    seulement pour un compte créé APRÈS le clic et dans les 30 j.
--  referral_commissions : créée par déclencheur quand un paiement
--    d'ABONNEMENT passe à 'success' (jamais sur inscription gratuite),
--    1 par paiement (payment_id unique), pour les N premiers paiements du
--    filleul (les commissions annulées comptent dans les N : un rembourse-
--    ment ne rouvre pas de droit). Paiement qui quitte 'success'
--    (remboursé, annulé…) → commission annulée. Aucune fonction de paiement
--    modifiée ; une erreur ici n'empêche jamais un paiement (warning).
--  referral_payouts : retrait mobile money ; 1 demande ouverte max ;
--    montant = tout le disponible, si ≥ seuil. L'admin marque payé / refusé
--    (refusé = le montant redevient disponible).
--  Disponible = commissions confirmées − retraits payés − retrait en cours.
--  Tables sous RLS sans politique : tout passe par les RPC ci-dessus
--  (session utilisateur ; admin = is_superadmin vérifié en base).
-- ---------------------------------------------------------------------------
