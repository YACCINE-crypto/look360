import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/billing";
import { COST_PER_CREDIT_FCFA } from "@/lib/adminCost";
import {
  Revenus,
  type RevenusData,
  type LowCredit,
  type FailedPayment,
  type SuspendedAccount,
} from "@/components/admin/Revenus";

export const dynamic = "force-dynamic";

const num = (x: unknown): number => (typeof x === "number" ? x : Number(x) || 0);

type Raw = {
  revenue_month: number;
  revenue_count_month: number;
  revenue_prev_month: number;
  revenue_total: number;
  credits_consumed_month: number;
  plan_starter: number;
  plan_pro: number;
  plan_business: number;
  revenue_by_month: { month: string; total: number }[];
  low_credits: LowCredit[];
  failed_payments: FailedPayment[];
  suspended: SuspendedAccount[];
};

export default async function AdminRevenusPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_revenue");
  const r = (data ?? {}) as Partial<Raw>;

  const revenueMonth = num(r.revenue_month);
  const credits = num(r.credits_consumed_month);
  const cout = Math.round(credits * COST_PER_CREDIT_FCFA);
  const mrr =
    num(r.plan_starter) * PLANS.starter.priceNormal +
    num(r.plan_pro) * PLANS.pro.priceNormal +
    num(r.plan_business) * PLANS.business.priceNormal;

  const k: RevenusData = {
    revenueMonth,
    revenueCountMonth: num(r.revenue_count_month),
    revenuePrevMonth: num(r.revenue_prev_month),
    revenueTotal: num(r.revenue_total),
    mrr,
    creditsConsumed: credits,
    coutEstime: cout,
    margeNette: revenueMonth - cout,
    series: (r.revenue_by_month ?? []).map((d) => ({
      month: d.month,
      total: num(d.total),
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-extrabold tracking-tight">Revenus &amp; marge</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Revenu réel encaissé, coût estimé, marge en direct — et les alertes à traiter.
        </p>
      </div>

      <Revenus
        k={k}
        lowCredits={r.low_credits ?? []}
        failedPayments={r.failed_payments ?? []}
        suspended={r.suspended ?? []}
      />
    </div>
  );
}
