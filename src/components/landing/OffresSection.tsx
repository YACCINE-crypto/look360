import Link from "next/link";
import type { ReactNode } from "react";
import { PLANS, formatCredits, type Plan } from "@/lib/billing";
import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

/* Reprend le design des cartes de la page /offres de l'app (liste de features
   détaillée par offre), adapté à la landing : CTA -> /signup (création de
   compte), pas d'état « offre actuelle ». Source de vérité = billing.ts. */

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const discountPct = (normal: number, first: number) =>
  Math.round((1 - first / normal) * 100);

const PAID_ORDER: Plan[] = ["starter", "pro", "business"];
const POPULAR: Plan = "pro";

const TAGLINE: Record<Plan, string> = {
  free: "",
  starter: "L'essentiel pour se lancer",
  pro: "Tout le Starter, plus l'automatisation",
  business: "Tout le Pro, à grande échelle",
};

const SUPPORT: Record<Plan, string> = {
  free: "communautaire",
  starter: "standard",
  pro: "prioritaire",
  business: "prioritaire (VIP)",
};

type Feat = { label: ReactNode; on: boolean };

/** Liste complète des fonctionnalités, avec ✅ inclus / ❌ non inclus. */
function features(p: Plan): Feat[] {
  const c = PLANS[p];
  const s = c.competitorSlots > 1 ? "s" : "";
  return [
    {
      label: (
        <>
          <b className="text-foreground font-semibold">
            {formatCredits(c.monthlyCredits)}
          </b>{" "}
          crédits / mois
        </>
      ),
      on: true,
    },
    { label: "Spy Facebook — recherche de pubs", on: true },
    { label: "Top Trend — classement produits", on: true },
    { label: "Analyse de concurrent", on: true },
    {
      label: (
        <>
          <b className="text-foreground font-semibold">
            Testing &amp; validation produit
          </b>{" "}
          — taux de closing, marge nette, verdict
        </>
      ),
      on: true,
    },
    { label: "Téléchargement des vidéos de pub", on: true },
    {
      label: (
        <>
          Suivi de{" "}
          <b className="text-foreground font-semibold">{c.competitorSlots}</b>{" "}
          concurrent{s}
        </>
      ),
      on: c.competitorSlots > 0,
    },
    {
      label: c.winnerEnabled ? (
        <>
          Winner Agent auto —{" "}
          <b className="text-foreground font-semibold">
            {c.winnerKeywords} mots-clés
          </b>{" "}
          × {c.winnerCountries} pays
        </>
      ) : (
        "Winner Agent automatique"
      ),
      on: c.winnerEnabled,
    },
    { label: "Winners du jour sur WhatsApp", on: c.whatsapp },
    { label: "Vitrine des winners validés", on: c.vitrineEnabled },
    {
      label: (
        <>
          Support <b className="text-foreground font-semibold">{SUPPORT[p]}</b>
        </>
      ),
      on: true,
    },
  ];
}

export function OffresSection() {
  return (
    <section id="tarifs" className="scroll-mt-20 bg-[#f8faff] px-4 py-12 sm:px-6 sm:py-20">
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
          </div>
        </RevealOnScroll>

        {/* Bandeau promo lancement */}
        <RevealOnScroll delay={60}>
          <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 px-4 py-2 text-center text-sm font-semibold text-orange-700">
            <Icon name="sparkles" size={16} />
            Offre de lancement — jusqu&apos;à −33&nbsp;% sur le 1<sup>er</sup> mois
          </div>
        </RevealOnScroll>

        {/* Grille des 3 offres payantes */}
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3 md:items-stretch">
          {PAID_ORDER.map((p, i) => {
            const cfg = PLANS[p];
            const isPopular = p === POPULAR;
            const pct =
              cfg.priceFirst != null
                ? discountPct(cfg.priceNormal, cfg.priceFirst)
                : 0;

            return (
              <RevealOnScroll key={p} delay={i * 90}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl border p-6 ${
                    isPopular
                      ? "border-primary/40 from-secondary/60 to-surface ring-primary shadow-primary/10 bg-gradient-to-b shadow-xl ring-2 md:-my-2 md:py-8"
                      : "border-border bg-surface shadow-card"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="from-primary inline-flex items-center gap-1 rounded-full bg-gradient-to-r to-blue-500 px-3 py-1 text-xs font-bold text-white shadow-md">
                        <Icon name="crown" size={13} /> Populaire
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-xl font-bold">{cfg.label}</h3>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {TAGLINE[p]}
                    </p>
                  </div>

                  {/* Prix + promo */}
                  <div className="min-h-[100px]">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-muted-foreground text-base font-medium line-through">
                        {fcfa(cfg.priceNormal)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm">
                        <Icon name="sparkles" size={11} />−{pct}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-primary text-4xl font-extrabold tabular-nums">
                        {new Intl.NumberFormat("fr-FR").format(cfg.priceFirst ?? 0)}
                      </span>
                      <span className="text-primary text-base font-bold">FCFA</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs font-medium">
                      le 1<sup>er</sup> mois, puis {fcfa(cfg.priceNormal)}/mois
                    </p>
                  </div>

                  {/* CTA -> inscription */}
                  <Link
                    href="/signup"
                    className={`mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95 ${
                      isPopular
                        ? "from-primary shadow-primary/25 bg-gradient-to-t to-blue-500 text-white shadow-lg"
                        : "bg-foreground text-background"
                    }`}
                  >
                    Choisir cette offre <Icon name="external" size={15} />
                  </Link>

                  {/* Comparatif complet des fonctionnalités */}
                  <ul className="border-border mt-6 space-y-2.5 border-t pt-5">
                    {features(p).map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2.5 text-sm">
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-content-center rounded-full ${
                            f.on
                              ? "bg-success-bg text-success"
                              : "bg-danger-bg text-danger"
                          }`}
                        >
                          {f.on ? (
                            <Icon name="check" size={13} strokeWidth={3} />
                          ) : (
                            <Icon name="x" size={12} strokeWidth={3} />
                          )}
                        </span>
                        <span
                          className={
                            f.on
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60 line-through"
                          }
                        >
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
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
      </div>
    </section>
  );
}
