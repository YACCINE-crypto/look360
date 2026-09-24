-- ============================================================================
-- 0027 — Table clients admin + actions superadmin (loggées).
-- Toutes les fonctions sont SECURITY DEFINER et REVÉRIFIENT is_superadmin().
-- Elles ne renvoient jamais rien à un non-superadmin.
-- ============================================================================

-- Suspension de compte (bloque l'accès à l'app).
alter table public.profiles
  add column if not exists suspended boolean not null default false;

-- Journal d'audit des actions superadmin (qui / quand / quoi).
create table if not exists public.admin_actions (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid references public.profiles (id) on delete set null,
  action     text not null,
  target     uuid,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
drop policy if exists admin_actions_select on public.admin_actions;
create policy admin_actions_select on public.admin_actions
  for select using (public.is_superadmin());
-- Insertion uniquement via les fonctions definer ci-dessous.
revoke all on public.admin_actions from anon, authenticated;
grant select on public.admin_actions to authenticated;

-- --- Liste paginée + filtres -------------------------------------------------
create or replace function public.admin_clients(
  p_search text default null,
  p_plan   text default null,
  p_status text default null,
  p_limit  int  default 25,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare rows jsonb; total int;
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;

  with base as (
    select s.user_id, s.plan, s.status, s.credits_balance, s.has_ever_paid,
           s.created_at, p.nom, p.suspended, u.email
    from public.subscriptions s
    join public.profiles p on p.id = s.user_id
    left join auth.users u on u.id = s.user_id
    where (p_plan is null or s.plan = p_plan)
      and (p_status is null or s.status = p_status)
      and (
        p_search is null
        or u.email ilike '%' || p_search || '%'
        or coalesce(p.nom, '') ilike '%' || p_search || '%'
      )
  ),
  enriched as (
    select b.*,
      (select count(*) from public.spy_searches ss where ss.user_id = b.user_id) as searches_count,
      (select count(*) from public.tests t
         join public.produits pr on pr.id = t.produit_id
        where pr.soumis_par = b.user_id) as tests_count,
      (select coalesce(sum(pay.amount), 0) from public.payments pay
        where pay.user_id = b.user_id and pay.status = 'success') as ca_genere
    from base b
  )
  select
    coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb),
    (select count(*) from base)
  into rows, total
  from (select * from enriched order by created_at desc limit p_limit offset p_offset) e;

  return jsonb_build_object('rows', rows, 'total', total);
end;
$$;

-- --- Détail d'un client ------------------------------------------------------
create or replace function public.admin_client_detail(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare result jsonb;
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;

  select jsonb_build_object(
    'client', (
      select to_jsonb(x) from (
        select s.user_id, s.plan, s.status, s.credits_balance, s.pack_credits,
               s.monthly_credits, s.has_ever_paid, s.current_period_end,
               s.created_at, p.nom, p.role, p.suspended, u.email,
               (select count(*) from public.spy_searches ss where ss.user_id = s.user_id) as searches_count,
               (select count(*) from public.tests t join public.produits pr on pr.id = t.produit_id
                 where pr.soumis_par = s.user_id) as tests_count,
               (select coalesce(sum(pay.amount),0) from public.payments pay
                 where pay.user_id = s.user_id and pay.status='success') as ca_genere
        from public.subscriptions s
        join public.profiles p on p.id = s.user_id
        left join auth.users u on u.id = s.user_id
        where s.user_id = p_user
      ) x
    ),
    'payments', (
      select coalesce(jsonb_agg(to_jsonb(pp) order by pp.created_at desc), '[]'::jsonb)
      from (select amount, currency, status, purpose, plan, created_at
              from public.payments where user_id = p_user
              order by created_at desc limit 10) pp
    ),
    'ledger', (
      select coalesce(jsonb_agg(to_jsonb(cl) order by cl.created_at desc), '[]'::jsonb)
      from (select amount, type, reason, balance_after, created_at
              from public.credit_ledger where user_id = p_user
              order by created_at desc limit 10) cl
    ),
    'actions', (
      select coalesce(jsonb_agg(to_jsonb(aa) order by aa.created_at desc), '[]'::jsonb)
      from (select action, detail, created_at
              from public.admin_actions where target = p_user
              order by created_at desc limit 10) aa
    )
  ) into result;
  return result;
end;
$$;

-- --- Actions loggées ---------------------------------------------------------
create or replace function public.admin_grant_credits(
  p_user uuid, p_amount int, p_reason text default 'Crédits offerts (admin)'
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be > 0'; end if;
  perform public.apply_credits(p_user, abs(p_amount), 'grant', p_reason, null);
  insert into public.admin_actions(actor, action, target, detail)
    values (auth.uid(), 'grant_credits', p_user,
            jsonb_build_object('amount', abs(p_amount), 'reason', p_reason));
end;
$$;

create or replace function public.admin_set_plan(p_user uuid, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  if p_plan not in ('free','starter','pro','business') then raise exception 'invalid plan'; end if;
  perform public.set_plan(p_user, p_plan);
  insert into public.admin_actions(actor, action, target, detail)
    values (auth.uid(), 'set_plan', p_user, jsonb_build_object('plan', p_plan));
end;
$$;

create or replace function public.admin_set_suspended(p_user uuid, p_bool boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  update public.profiles set suspended = p_bool where id = p_user;
  insert into public.admin_actions(actor, action, target, detail)
    values (auth.uid(), 'set_suspended', p_user, jsonb_build_object('suspended', p_bool));
end;
$$;

-- Grants : self-gated par is_superadmin(), jamais anon.
do $$
declare fn text;
begin
  foreach fn in array array[
    'admin_clients(text,text,text,int,int)',
    'admin_client_detail(uuid)',
    'admin_grant_credits(uuid,int,text)',
    'admin_set_plan(uuid,text)',
    'admin_set_suspended(uuid,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated;', fn);
    execute format('grant execute on function public.%s to authenticated;', fn);
  end loop;
end $$;
