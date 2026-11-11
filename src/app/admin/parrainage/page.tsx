import { createClient } from "@/lib/supabase/server";
import { fcfa, methodLabel, type ReferralSettings } from "@/lib/referralFormat";
import { PayoutActions, SettingsForm } from "./ReferralAdminClient";

export const dynamic = "force-dynamic";

type Overview = {
  settings: ReferralSettings;
  affiliates: { user_id: string; code: string; nom: string | null; email: string; clicks: number; signups: number; converted: number; earned: number; paid: number; requested: number; available: number }[];
  payouts: { id: string; created_at: string; amount: number; method: string; phone: string; status: string; admin_note: string | null; processed_at: string | null; code: string | null; nom: string | null; email: string }[];
  commissions: { id: string; created_at: string; month_index: number; base_amount: number; amount: number; status: string; cancel_reason: string | null; referrer_code: string | null; referrer_email: string; referee_email: string }[];
};

const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Superadmin : affiliés, retraits à payer, commissions, règles. Lecture via RPC (session, rôle vérifié en base). */
export default async function AdminParrainagePage() {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { rpc: (f: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(
    "admin_referral_overview",
  );
  const o = data as Overview | null;
  const open = o?.payouts.filter((p) => p.status === "requested") ?? [];
  const due = o?.affiliates.reduce((s, a) => s + a.available + a.requested, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-fg text-2xl font-extrabold tracking-tight">Parrainage</h1>
        <p className="text-muted-foreground mt-1 text-sm">Commissions sur les abonnements payés des filleuls. Retraits versés à la main en mobile money.</p>
      </div>

      {error || !o ? (
        <p className="bg-danger-bg text-danger-fg rounded-lg p-4 text-sm">Lecture impossible : {error?.message ?? "aucune donnée"}. La migration 0044 est-elle appliquée ?</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Retraits à payer" value={String(open.length)} sub={fcfa(open.reduce((s, p) => s + p.amount, 0))} tone={open.length ? "warn" : undefined} />
            <Kpi label="Commissions dues (non versées)" value={fcfa(due)} />
            <Kpi label="Affiliés actifs" value={String(o.affiliates.length)} />
            <Kpi label="Filleuls abonnés" value={String(o.affiliates.reduce((s, a) => s + a.converted, 0))} />
          </section>

          <Panel title="Demandes de retrait">
            {o.payouts.length === 0 ? (
              <Empty>Aucune demande pour l&apos;instant.</Empty>
            ) : (
              <Table head={["Date", "Affilié", "Montant", "Mobile money", "Statut", ""]}>
                {o.payouts.map((p) => (
                  <tr key={p.id} className="border-border border-t align-middle">
                    <Td>{date(p.created_at)}</Td>
                    <Td>
                      <span className="text-fg font-medium">{p.nom ?? p.email}</span>
                      <span className="text-muted-foreground block text-xs">{p.email}{p.code ? ` · ${p.code}` : ""}</span>
                    </Td>
                    <Td className="text-fg font-semibold tabular-nums">{fcfa(p.amount)}</Td>
                    <Td>
                      {methodLabel(p.method)}
                      <span className="text-muted-foreground block font-mono text-xs">{p.phone}</span>
                    </Td>
                    <Td>
                      <Status s={p.status} />
                      {p.admin_note && <span className="text-muted-foreground block text-xs">{p.admin_note}</span>}
                    </Td>
                    <Td className="text-right">{p.status === "requested" && <PayoutActions id={p.id} />}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Affiliés">
            {o.affiliates.length === 0 ? (
              <Empty>Aucun lien encore cliqué.</Empty>
            ) : (
              <Table head={["Affilié", "Code", "Clics", "Inscrits", "Abonnés", "Gagné", "Versé", "Dû"]}>
                {o.affiliates.map((a) => (
                  <tr key={a.user_id} className="border-border border-t">
                    <Td>
                      <span className="text-fg font-medium">{a.nom ?? a.email}</span>
                      <span className="text-muted-foreground block text-xs">{a.email}</span>
                    </Td>
                    <Td className="font-mono">{a.code}</Td>
                    <Td num>{a.clicks}</Td>
                    <Td num>{a.signups}</Td>
                    <Td num>{a.converted}</Td>
                    <Td num>{fcfa(a.earned)}</Td>
                    <Td num>{fcfa(a.paid)}</Td>
                    <Td num className="text-fg font-semibold">{fcfa(a.available + a.requested)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Commissions">
            {o.commissions.length === 0 ? (
              <Empty>Aucune commission : elles naissent quand un filleul paie son abonnement.</Empty>
            ) : (
              <Table head={["Date", "Affilié", "Filleul", "Paiement", "Base", "Commission", "Statut"]}>
                {o.commissions.map((c) => (
                  <tr key={c.id} className="border-border border-t">
                    <Td>{date(c.created_at)}</Td>
                    <Td>{c.referrer_code ?? c.referrer_email}</Td>
                    <Td>{c.referee_email}</Td>
                    <Td num>
                      {c.month_index}/{o.settings.months}
                    </Td>
                    <Td num>{fcfa(c.base_amount)}</Td>
                    <Td num className="text-fg font-semibold">{fcfa(c.amount)}</Td>
                    <Td>
                      <Status s={c.status} />
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Règles du programme">
            <div className="p-5">
              <SettingsForm initial={o.settings} />
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" ? "border-warn bg-warn-bg" : "border-border bg-surface"}`}>
      <p className={`text-xs font-medium ${tone === "warn" ? "text-warn-fg" : "text-muted-foreground"}`}>{label}</p>
      <p className="text-fg mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground text-xs tabular-nums">{sub}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-surface overflow-hidden rounded-xl border">
      <h2 className="border-border border-b px-5 py-3.5 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="text-muted-foreground px-4 py-2.5 text-xs font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, num, className = "" }: { children?: React.ReactNode; num?: boolean; className?: string }) {
  return <td className={`text-fg-2 px-4 py-2.5 ${num ? "tabular-nums whitespace-nowrap" : ""} ${className}`}>{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground px-5 py-8 text-center text-sm">{children}</p>;
}

function Status({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    requested: ["À payer", "bg-warn-bg text-warn-fg"],
    paid: ["Payé", "bg-success-bg text-success-fg"],
    rejected: ["Refusé", "bg-input text-fg-2"],
    confirmed: ["Validée", "bg-success-bg text-success-fg"],
    cancelled: ["Annulée", "bg-danger-bg text-danger-fg"],
  };
  const [label, tone] = map[s] ?? [s, "bg-input text-fg-2"];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tone}`}>{label}</span>;
}
