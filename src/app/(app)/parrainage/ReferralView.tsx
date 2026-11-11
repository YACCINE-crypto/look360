import { Check, Clock, MousePointerClick, UserPlus, Wallet, X } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { fcfa, methodLabel, referralLink, ruleText, type ReferralSettings } from "@/lib/referralFormat";
import { CopyLink, PayoutForm } from "./ReferralClient";

export type Dashboard = {
  code: string;
  settings: ReferralSettings;
  clicks: number;
  signups: number;
  converted: number;
  balance: { earned: number; cancelled: number; paid: number; requested: number; available: number };
  open_payout: { id: string; amount: number; method: string; phone: string; created_at: string } | null;
  commissions: { id: string; created_at: string; month_index: number; base_amount: number; amount: number; status: string; cancel_reason: string | null; referee: string }[];
  payouts: { id: string; created_at: string; amount: number; method: string; status: string; processed_at: string | null }[];
};

const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/** Tableau de bord affilié (données de my_referral_dashboard). */
export function ReferralView({ d }: { d: Dashboard }) {
  const link = referralLink(d.code);
  const min = d.settings.min_payout;
  const avail = d.balance.available;
  const progress = Math.min(100, Math.round((avail / Math.max(1, min)) * 100));

  type Line = { key: string; at: string; label: string; detail: string; amount: number; sign: 1 | -1; state: "ok" | "wait" | "off" };
  const history: Line[] = [
    ...d.commissions.map((c): Line => ({
      key: c.id,
      at: c.created_at,
      label: `Commission · ${c.referee}`,
      detail: `Paiement ${c.month_index} sur ${d.settings.months} · ${fcfa(c.base_amount)}`,
      amount: c.amount,
      sign: 1,
      state: c.status === "cancelled" ? "off" : "ok",
    })),
    ...d.payouts.map((p): Line => ({
      key: p.id,
      at: p.created_at,
      label: `Retrait ${methodLabel(p.method)}`,
      detail: p.status === "paid" ? `Payé le ${date(p.processed_at ?? p.created_at)}` : p.status === "rejected" ? "Refusé, montant rendu disponible" : "En cours de traitement",
      amount: p.amount,
      sign: -1,
      state: p.status === "paid" ? "ok" : p.status === "rejected" ? "off" : "wait",
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parrainage"
        subtitle={`Partage ton lien : tu gagnes ${ruleText(d.settings)} de chaque personne qui s'abonne. Rien sur les comptes gratuits.`}
      />

      {/* Lien */}
      <section aria-labelledby="ref-link" className="border-border bg-surface rounded-xl border p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 id="ref-link" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Ton lien
            </h2>
            <p className="text-fg mt-1 font-mono text-lg font-semibold break-all">{link}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Code <span className="text-fg font-mono font-semibold">{d.code}</span> · valable {d.settings.attribution_days} jours après le clic ·
              c&apos;est le dernier lien cliqué qui compte.
            </p>
          </div>
          <CopyLink link={link} />
        </div>
      </section>

      {/* Résultats */}
      <section aria-label="Résultats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<MousePointerClick size={16} />} label="Clics" value={String(d.clicks)} />
        <Kpi icon={<UserPlus size={16} />} label="Inscrits" value={String(d.signups)} />
        <Kpi icon={<Check size={16} />} label="Abonnés convertis" value={String(d.converted)} />
        <Kpi icon={<Wallet size={16} />} label="Gains cumulés" value={fcfa(d.balance.earned)} />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Historique */}
        <section aria-labelledby="ref-history" className="border-border bg-surface rounded-xl border">
          <h2 id="ref-history" className="border-border border-b px-5 py-4 text-base font-bold">
            Historique
          </h2>
          {history.length === 0 ? (
            <p className="text-muted-foreground px-5 py-10 text-center text-sm">
              Aucune commission pour l&apos;instant. Elle apparaît ici dès qu&apos;un filleul paie son abonnement.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {history.map((h) => (
                <li key={h.key} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      h.state === "ok" ? "bg-success-bg text-success-fg" : h.state === "wait" ? "bg-warn-bg text-warn-fg" : "bg-input text-fg-2"
                    }`}
                    aria-hidden
                  >
                    {h.state === "ok" ? <Check size={15} /> : h.state === "wait" ? <Clock size={15} /> : <X size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-sm font-medium">{h.label}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {date(h.at)} · {h.detail}
                      {h.state === "off" && h.sign === 1 ? " · annulée (paiement remboursé ou annulé)" : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      h.state === "off" ? "text-muted-foreground line-through" : h.sign === 1 ? "text-success-fg" : "text-fg"
                    }`}
                  >
                    {h.sign === 1 ? "+" : "−"}
                    {fcfa(h.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Retrait */}
        <aside aria-labelledby="ref-payout" className="border-border bg-surface space-y-4 rounded-xl border p-5 lg:sticky lg:top-6">
          <div>
            <h2 id="ref-payout" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Disponible
            </h2>
            <p className="text-fg mt-1 text-3xl font-bold tabular-nums">{fcfa(avail)}</p>
            <dl className="text-muted-foreground mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Déjà versé</dt>
                <dd className="text-fg tabular-nums">{fcfa(d.balance.paid)}</dd>
              </div>
              {d.balance.requested > 0 && (
                <div className="flex justify-between">
                  <dt>Retrait en cours</dt>
                  <dd className="text-fg tabular-nums">{fcfa(d.balance.requested)}</dd>
                </div>
              )}
            </dl>
          </div>

          {d.open_payout ? (
            <p className="bg-warn-bg text-warn-fg rounded-md p-3 text-sm">
              Retrait de <strong>{fcfa(d.open_payout.amount)}</strong> demandé le {date(d.open_payout.created_at)} sur{" "}
              {methodLabel(d.open_payout.method)} ({d.open_payout.phone}). Versement manuel sous quelques jours.
            </p>
          ) : avail >= min ? (
            <PayoutForm amount={avail} />
          ) : (
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Seuil de retrait</span>
                <span className="text-fg font-medium tabular-nums">
                  {fcfa(avail)} / {fcfa(min)}
                </span>
              </div>
              <span className="bg-input mt-2 block h-1.5 overflow-hidden rounded-full" aria-hidden>
                <span className="bg-accent block h-full rounded-full" style={{ width: `${progress}%` }} />
              </span>
              <p className="text-muted-foreground mt-2 text-sm">
                Le retrait mobile money s&apos;active à partir de {fcfa(min)} disponibles. Encore {fcfa(Math.max(0, min - avail))}.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border-border bg-surface rounded-xl border p-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        {icon} {label}
      </p>
      <p className="text-fg mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
