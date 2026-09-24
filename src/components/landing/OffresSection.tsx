import Link from "next/link";
import { PLANS, formatCredits, type Plan } from "@/lib/billing";
import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const pct = (normal: number, first: number) =>
  Math.round((1 - first / normal) * 100);

const PAID: Plan[] = ["starter", "pro", "business"];
const POPULAR: Plan = "pro";

const TAGLINE: Record<Plan, string> = {
  free: "",
  starter: "L'essentiel pour se lancer",
  pro: "Tout le Starter, plus l'automatisation",
  business: "Tout le Pro, à grande échelle",
};

// Tableau comparatif (ordre STEP 6 : Testing tout en haut).
type Row = { label: string; cells: (boolean | string)[] }; // [free, starter, pro, business]
const ROWS: Row[] = [
  { label: "Testing & validation produit (closing, marge, verdict)", cells: [true, true, true, true] },
  { label: "Recherche de winners (Afrique + Europe)", cells: [true, true, true, true] },
  { label: "Top Trend", cells: [true, true, true, true] },
  { label: "Téléchargement des créatives", cells: [false, true, true, true] },
  { label: "Suivi de concurrents", cells: [false, "1", "3", "10"] },
  { label: "Winner Agent (winners du jour auto)", cells: [false, false, true, true] },
  { label: "Winners sur WhatsApp", cells: [false, false, true, true] },
  { label: "Vitrine des winners validés", cells: [false, false, false, true] },
  { label: "Support", cells: ["standard", "standard", "standard", "prioritaire"] },
];

export function OffresSection() {
  return (
    <section id="tarifs" className="bg-surface scroll-mt-20 px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll>
          <div className="text-center">
            <h2 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
              Commence gratuit. Passe payant quand tu gagnes.
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-base">
              Paiement mobile money, pas de carte bancaire. Change ou annule
              quand tu veux.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-700">
              <Icon name="trending" size={13} /> 1<sup>er</sup> mois à prix réduit
            </span>
          </div>
        </RevealOnScroll>

        {/* Cartes offres payantes */}
        <div className="mt-10 grid gap-5 md:grid-cols-3 md:items-stretch">
          {PAID.map((p, i) => {
            const c = PLANS[p];
            const isPop = p === POPULAR;
            const reduc = c.priceFirst != null ? pct(c.priceNormal, c.priceFirst) : 0;
            return (
              <RevealOnScroll key={p} delay={i * 90}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl border p-6 ${
                    isPop
                      ? "border-primary/40 from-secondary/60 to-surface ring-primary shadow-primary/10 bg-gradient-to-b shadow-xl ring-2 md:-my-2 md:py-8"
                      : "border-border bg-surface shadow-card"
                  }`}
                >
                  {isPop && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="from-primary inline-flex items-center gap-1 rounded-full bg-gradient-to-r to-blue-500 px-3 py-1 text-xs font-bold text-white shadow-md">
                        <Icon name="trophy" size={13} /> Populaire
                      </span>
                    </div>
                  )}

                  <h3 className="text-xl font-bold">{c.label}</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">{TAGLINE[p]}</p>

                  {/* Prix + promo */}
                  <div className="mt-4 min-h-[96px]">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-muted-foreground text-base font-medium line-through">
                        {fcfa(c.priceNormal)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm">
                        −{reduc}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-primary text-4xl font-extrabold tabular-nums">
                        {new Intl.NumberFormat("fr-FR").format(c.priceFirst ?? 0)}
                      </span>
                      <span className="text-primary text-base font-bold">FCFA</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs font-medium">
                      le 1<sup>er</sup> mois, puis {fcfa(c.priceNormal)}/mois
                    </p>
                  </div>

                  <p className="text-foreground mt-1 text-sm font-semibold">
                    {formatCredits(c.monthlyCredits)} crédits / mois
                  </p>

                  <Link
                    href="/signup"
                    className={`mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95 ${
                      isPop
                        ? "from-primary shadow-primary/25 bg-gradient-to-t to-blue-500 text-white shadow-lg"
                        : "bg-foreground text-background"
                    }`}
                  >
                    Commencer <Icon name="chevronRight" size={16} />
                  </Link>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>

        {/* Bandeau Gratuit */}
        <RevealOnScroll delay={120}>
          <div className="border-border bg-background mt-5 flex flex-col items-center justify-between gap-3 rounded-2xl border px-5 py-4 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-foreground font-bold">Offre Gratuite</p>
              <p className="text-muted-foreground text-sm">
                {formatCredits(PLANS.free.monthlyCredits)} crédits / mois · testing
                inclus · sans carte bancaire
              </p>
            </div>
            <Link
              href="/signup"
              className="border-border text-foreground hover:bg-input inline-flex min-h-[44px] items-center justify-center rounded-full border px-5 text-sm font-semibold"
            >
              Commencer gratuitement
            </Link>
          </div>
        </RevealOnScroll>

        {/* Tableau comparatif complet */}
        <RevealOnScroll delay={140}>
          <div className="border-border bg-surface shadow-card mt-10 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fonctionnalité
                  </th>
                  {(["free", "starter", "pro", "business"] as Plan[]).map((p) => (
                    <th
                      key={p}
                      className={`w-28 px-2 py-3 text-center text-sm font-bold ${
                        p === POPULAR ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {PLANS[p].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-border/60 border-b">
                  <td className="px-4 py-3 font-medium">Crédits / mois</td>
                  {(["free", "starter", "pro", "business"] as Plan[]).map((p) => (
                    <td key={p} className="px-2 py-3 text-center text-xs font-bold tabular-nums">
                      {formatCredits(PLANS[p].monthlyCredits)}
                    </td>
                  ))}
                </tr>
                {ROWS.map((r, i) => (
                  <tr key={i} className="border-border/60 border-b last:border-0">
                    <td className="px-4 py-3">{r.label}</td>
                    {r.cells.map((cell, j) => (
                      <td key={j} className="px-2 py-3 text-center">
                        <Cell v={cell} pop={j === 2} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

function Cell({ v, pop }: { v: boolean | string; pop: boolean }) {
  if (v === true) {
    return (
      <span
        className={`inline-grid h-6 w-6 place-items-center rounded-full ${
          pop ? "bg-primary/10 text-primary" : "bg-success-bg text-success"
        }`}
      >
        <Icon name="check" size={13} strokeWidth={3} />
      </span>
    );
  }
  if (v === false) {
    return (
      <span className="text-muted-foreground/40 inline-grid h-6 w-6 place-items-center">
        <Icon name="x" size={13} strokeWidth={3} />
      </span>
    );
  }
  return <span className="text-foreground text-xs font-semibold">{v}</span>;
}
