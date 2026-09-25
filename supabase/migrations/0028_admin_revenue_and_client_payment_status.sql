-- ============================================================================
-- 0028 — Revenus & marge (STEP 5) + statut paiement/abonnement sur la liste.
-- Toutes les fonctions restent SECURITY DEFINER et REVÉRIFIENT is_superadmin().
-- 100% données réelles. Le calcul monétaire (prix des offres, coût par crédit)
-- reste côté app (src/lib/billing.ts + adminCost.ts) : la SQL ne renvoie que
-- des agrégats bruts.
-- ============================================================================

-- --- Liste clients : + échéance abonnement + dernier paiement ----------------
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
    select s.user_id, s.plan, s.status, s.credits_balance, s.monthly_credits,
           s.has_ever_paid, s.current_period_end, s.created_at,
           p.nom, p.suspended, u.email
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
        where pay.user_id = b.user_id and pay.status = 'success') as ca_genere,
      lp.status as last_payment_status,
      lp.created_at as last_payment_at
    from base b
    left join lateral (
      select status, created_at from public.payments pay
       where pay.user_id = b.user_id
       order by created_at desc limit 1
    ) lp on true
  )
  select
    coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb),
    (select count(*) from base)
  into rows, total
  from (select * from enriched order by created_at desc limit p_limit offset p_offset) e;

  return jsonb_build_object('rows', rows, 'total', total);
end;
$$;

-- --- Revenus & marge + alertes ----------------------------------------------
create or replace function public.admin_revenue()
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
    -- Revenus réels (paiements réussis)
    'revenue_month', (select coalesce(sum(amount),0) from public.payments
        where status='success' and created_at >= date_trunc('month', now())),
    'revenue_count_month', (select count(*) from public.payments
        where status='success' and created_at >= date_trunc('month', now())),
    'revenue_prev_month', (select coalesce(sum(amount),0) from public.payments
        where status='success'
          and created_at >= date_trunc('month', now()) - interval '1 month'
          and created_at <  date_trunc('month', now())),
    'revenue_total', (select coalesce(sum(amount),0) from public.payments where status='success'),

    -- Consommation de crédits du mois (base du coût estimé, calcul côté app)
    'credits_consumed_month', (select coalesce(sum(abs(amount)),0) from public.credit_ledger
        where type='consumption' and created_at >= date_trunc('month', now())),

    -- Répartition des offres (pour le MRR, prix côté app)
    'plan_starter', (select count(*) from public.subscriptions where plan='starter' and status='active'),
    'plan_pro', (select count(*) from public.subscriptions where plan='pro' and status='active'),
    'plan_business', (select count(*) from public.subscriptions where plan='business' and status='active'),

    -- Série revenus par mois (12 derniers mois, réels)
    'revenue_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'total', t) order by m), '[]'::jsonb)
      from (
        select date_trunc('month', gs) as m,
          (select coalesce(sum(amount),0) from public.payments
             where status='success' and date_trunc('month', created_at) = date_trunc('month', gs)) as t
        from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') gs
      ) q
    ),

    -- ALERTE 1 : comptes proches de leur limite de crédits (actifs, payants)
    'low_credits', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.ratio asc), '[]'::jsonb) from (
        select s.user_id, u.email, s.plan, s.credits_balance, s.monthly_credits,
          round((s.credits_balance::numeric / nullif(s.monthly_credits,0)) * 100) as ratio
        from public.subscriptions s
        left join auth.users u on u.id = s.user_id
        where s.status='active' and s.plan <> 'free' and s.monthly_credits > 0
          and s.credits_balance <= s.monthly_credits * 0.15
        order by ratio asc nulls last limit 20
      ) x
    ),

    -- ALERTE 2 : paiements échoués récents (30 jours)
    'failed_payments', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select pay.user_id, u.email, pay.amount, pay.plan, pay.purpose,
               pay.status, pay.created_at
        from public.payments pay
        left join auth.users u on u.id = pay.user_id
        where pay.status in ('failed','error','cancelled')
          and pay.created_at >= now() - interval '30 days'
        order by pay.created_at desc limit 20
      ) x
    ),

    -- ALERTE 3 : comptes suspendus
    'suspended', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.email asc), '[]'::jsonb) from (
        select p.id as user_id, u.email, s.plan
        from public.profiles p
        left join auth.users u on u.id = p.id
        left join public.subscriptions s on s.user_id = p.id
        where p.suspended = true limit 50
      ) x
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_revenue() from public, anon, authenticated;
grant execute on function public.admin_revenue() to authenticated;
