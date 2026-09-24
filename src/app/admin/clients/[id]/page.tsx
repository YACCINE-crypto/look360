import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planLabel, formatCredits } from "@/lib/billing";
import { Icon } from "@/components/Icon";
import { grantCredits, setPlan, setSuspended } from "../actions";

export const dynamic = "force-dynamic";

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

type Client = {
  user_id: string;
  email: string | null;
  nom: string | null;
  role: string;
  plan: string;
  status: string;
  credits_balance: number | null;
  pack_credits: number | null;
  monthly_credits: number | null;
  has_ever_paid: boolean;
  suspended: boolean;
  current_period_end: string | null;
  created_at: string;
  searches_count: number;
  tests_count: number;
  ca_genere: number;
};
type Detail = {
  client: Client | null;
  payments: { amount: number; currency: string; status: string; purpose: string; plan: string | null; created_at: string }[];
  ledger: { amount: number; type: string; reason: string | null; balance_after: number; created_at: string }[];
  actions: { action: string; detail: Record<string, unknown>; created_at: string }[];
};

const ACTION_LABEL: Record<string, string> = {
  grant_credits: "Crédits offerts",
  set_plan: "Changement d'offre",
  set_suspended: "Suspension / réactivation",
};

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_client_detail", { p_user: id });
  const d = (data ?? {}) as Detail;
  const c = d.client;
  if (!c) notFound();

  return (
    <div className="space-y-5">
      <Link href="/admin/clients" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <Icon name="chevronRight" size={15} className="rotate-180" /> Clients
      </Link>

      {/* En-tête client */}
      <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-foreground truncate text-xl font-extrabold">
              {c.email ?? c.nom ?? "—"}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {c.nom ? `${c.nom} · ` : ""}Inscrit le{" "}
              {new Date(c.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-secondary text-primary rounded-full px-2.5 py-1 text-xs font-semibold">
              {planLabel(c.plan)}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.suspended ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>
              {c.suspended ? "Suspendu" : c.status}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fig label="Solde crédits" value={formatCredits(c.credits_balance ?? 0)} />
          <Fig label="Recherches" value={String(c.searches_count)} />
          <Fig label="Tests" value={String(c.tests_count)} />
          <Fig label="CA généré" value={c.has_ever_paid ? fcfa(c.ca_genere) : "—"} />
        </div>
      </div>

      {/* Actions superadmin */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Offrir des crédits */}
        <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
          <p className="text-foreground font-semibold">Offrir des crédits</p>
          <form action={grantCredits} className="mt-3 space-y-2">
            <input type="hidden" name="user" value={c.user_id} />
            <input
              name="amount"
              type="number"
              min={1}
              required
              placeholder="Nombre de crédits"
              className="border-border bg-input focus:border-primary min-h-[42px] w-full rounded-lg border px-3 text-sm outline-none"
            />
            <input
              name="reason"
              type="text"
              placeholder="Motif (optionnel)"
              className="border-border bg-input focus:border-primary min-h-[42px] w-full rounded-lg border px-3 text-sm outline-none"
            />
            <button className="bg-primary text-primary-foreground min-h-[42px] w-full rounded-lg text-sm font-semibold">
              Créditer
            </button>
          </form>
        </div>

        {/* Changer l'offre */}
        <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
          <p className="text-foreground font-semibold">Changer l&apos;offre</p>
          <form action={setPlan} className="mt-3 space-y-2">
            <input type="hidden" name="user" value={c.user_id} />
            <select name="plan" defaultValue={c.plan} className="border-border bg-input min-h-[42px] w-full rounded-lg border px-3 text-sm outline-none">
              <option value="free">Gratuit</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
            <p className="text-muted-foreground text-[11px]">
              Applique l&apos;offre + les crédits mensuels correspondants.
            </p>
            <button className="bg-foreground text-background min-h-[42px] w-full rounded-lg text-sm font-semibold">
              Appliquer l&apos;offre
            </button>
          </form>
        </div>

        {/* Suspendre / réactiver */}
        <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
          <p className="text-foreground font-semibold">
            {c.suspended ? "Réactiver le compte" : "Suspendre le compte"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {c.suspended
              ? "Le compte est actuellement suspendu (accès bloqué)."
              : "Bloque l'accès à l'app jusqu'à réactivation."}
          </p>
          <form action={setSuspended} className="mt-3">
            <input type="hidden" name="user" value={c.user_id} />
            <input type="hidden" name="suspend" value={c.suspended ? "0" : "1"} />
            <button
              className={`min-h-[42px] w-full rounded-lg text-sm font-semibold ${
                c.suspended
                  ? "bg-success text-primary-foreground"
                  : "bg-danger text-primary-foreground"
              }`}
            >
              {c.suspended ? "Réactiver" : "Suspendre"}
            </button>
          </form>
        </div>
      </div>

      {/* Historiques */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HistoryCard title="Paiements récents">
          {d.payments.length === 0 ? (
            <Empty />
          ) : (
            d.payments.map((p, i) => (
              <Row key={i} left={`${p.purpose === "subscription" ? "Abonnement" : "Recharge"}${p.plan ? ` · ${planLabel(p.plan)}` : ""}`} right={fcfa(p.amount)} date={p.created_at} tone={p.status === "success" ? "success" : "muted"} />
            ))
          )}
        </HistoryCard>

        <HistoryCard title="Mouvements de crédits">
          {d.ledger.length === 0 ? (
            <Empty />
          ) : (
            d.ledger.map((l, i) => (
              <Row key={i} left={l.reason ?? l.type} right={`${l.amount > 0 ? "+" : ""}${formatCredits(l.amount)}`} date={l.created_at} tone={l.amount >= 0 ? "success" : "muted"} />
            ))
          )}
        </HistoryCard>

        <HistoryCard title="Journal admin (audit)">
          {d.actions.length === 0 ? (
            <Empty />
          ) : (
            d.actions.map((a, i) => (
              <Row key={i} left={ACTION_LABEL[a.action] ?? a.action} right={detailText(a.detail)} date={a.created_at} tone="muted" />
            ))
          )}
        </HistoryCard>
      </div>
    </div>
  );
}

function detailText(detail: Record<string, unknown>): string {
  if (typeof detail.amount === "number") return `+${detail.amount}`;
  if (typeof detail.plan === "string") return planLabel(detail.plan);
  if (typeof detail.suspended === "boolean") return detail.suspended ? "Suspendu" : "Réactivé";
  return "";
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background rounded-lg p-3">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="text-foreground text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function HistoryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border">
      <p className="border-border text-foreground border-b px-4 py-3 text-sm font-bold">{title}</p>
      <div className="divide-border divide-y">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-muted-foreground px-4 py-6 text-center text-sm">Aucun élément.</p>;
}

function Row({
  left,
  right,
  date,
  tone,
}: {
  left: string;
  right: string;
  date: string;
  tone: "success" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm">{left}</p>
        <p className="text-muted-foreground text-[11px]">
          {new Date(date).toLocaleString("fr-FR")}
        </p>
      </div>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${tone === "success" ? "text-success" : "text-foreground"}`}>
        {right}
      </span>
    </div>
  );
}
