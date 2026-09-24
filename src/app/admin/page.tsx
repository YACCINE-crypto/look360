import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/billing";
import { COST_PER_CREDIT_FCFA } from "@/lib/adminCost";
import { Cockpit, type CockpitData } from "@/components/admin/Cockpit";
import { Charts, type MonthPoint } from "@/components/admin/Charts";

export const dynamic = "force-dynamic";

type Raw = {
  revenue_month: number;
  revenue_count: number;
  inscrits_total: number;
  nouveaux_today: number;
  nouveaux_7d: number;
  plan_free: number;
  plan_starter: number;
  plan_pro: number;
  plan_business: number;
  ever_paid: number;
  credits_consumed_month: number;
};

const num = (x: unknown): number =>
  typeof x === "number" ? x : Number(x) || 0;

export default async function AdminCockpitPage() {
  const supabase = await createClient();
  // Agrégats réels, réservés superadmin (fonctions gardées).
  const [{ data }, { data: charts }] = await Promise.all([
    supabase.rpc("admin_cockpit"),
    supabase.rpc("admin_charts"),
  ]);
  const r = (data ?? {}) as Partial<Raw>;

  const c = (charts ?? {}) as {
    revenue_by_month?: { month: string; total: number }[];
    signups_by_month?: { month: string; count: number }[];
  };
  const revenue: MonthPoint[] = (c.revenue_by_month ?? []).map((d) => ({
    month: d.month,
    value: num(d.total),
  }));
  const signups: MonthPoint[] = (c.signups_by_month ?? []).map((d) => ({
    month: d.month,
    value: num(d.count),
  }));

  const free = num(r.plan_free);
  const starter = num(r.plan_starter);
  const pro = num(r.plan_pro);
  const business = num(r.plan_business);
  const inscrits = num(r.inscrits_total);
  const everPaid = num(r.ever_paid);
  const revenueMonth = num(r.revenue_month);
  const credits = num(r.credits_consumed_month);
  const cout = Math.round(credits * COST_PER_CREDIT_FCFA);
  const mrr =
    starter * PLANS.starter.priceNormal +
    pro * PLANS.pro.priceNormal +
    business * PLANS.business.priceNormal;

  const k: CockpitData = {
    revenueMonth,
    revenueCount: num(r.revenue_count),
    mrr,
    clientsActifs: starter + pro + business,
    inscritsTotal: inscrits,
    nouveauxToday: num(r.nouveaux_today),
    nouveaux7d: num(r.nouveaux_7d),
    conversion: inscrits > 0 ? Math.round((everPaid / inscrits) * 100) : 0,
    creditsConsumed: credits,
    coutEstime: cout,
    margeNette: revenueMonth - cout,
    plans: { free, starter, pro, business },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-extrabold tracking-tight">
          Cockpit
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Vue d&apos;ensemble de Look360 — données réelles en direct.
        </p>
      </div>

      <Cockpit k={k} />
      <Charts revenue={revenue} signups={signups} plans={k.plans} />
    </div>
  );
}
