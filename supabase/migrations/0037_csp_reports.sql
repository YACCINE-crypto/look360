-- ============================================================================
-- 0037 — Rapports CSP (mode observation). Une ligne par violation distincte
-- (directive × source bloquée × page), avec compteur : lisible sur plusieurs
-- jours sans exploser en volume. Accès serveur uniquement (service_role).
-- ============================================================================
create table if not exists public.csp_reports (
  directive text not null,
  blocked text not null,
  page text not null,
  hits integer not null default 1,
  sample jsonb,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (directive, blocked, page)
);
alter table public.csp_reports enable row level security;
revoke all on public.csp_reports from anon, authenticated;

create or replace function public.csp_report_hit(p_directive text, p_blocked text, p_page text, p_sample jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.csp_reports as r (directive, blocked, page, sample)
  values (left(p_directive, 120), left(p_blocked, 300), left(p_page, 200), p_sample)
  on conflict (directive, blocked, page) do update
    set hits = r.hits + 1, last_seen = now();
$$;

revoke execute on function public.csp_report_hit(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.csp_report_hit(text, text, text, jsonb) to service_role;
