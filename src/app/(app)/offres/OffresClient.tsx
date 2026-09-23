"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";
import NumberFlow from "@number-flow/react";
import {
  Zap,
  Users,
  Bot,
  Check,
  X,
  Sparkles,
  Crown,
  ArrowUpRight,
} from "lucide-react";
import {
  PLANS,
  PLAN_ORDER,
  CREDIT_PACKS,
  formatCredits,
  planLabel,
  type Plan,
} from "@/lib/billing";

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const discountPct = (normal: number, first: number) =>
  Math.round((1 - first / normal) * 100);

/** Offres populaires mises en avant. */
const POPULAR: Plan = "pro";

const reveal: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: i * 0.09,
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

export default function OffresClient({
  current,
  balance,
}: {
  current: Plan;
  balance: number;
}) {
  // Démarre les prix à 0 puis anime vers la vraie valeur (compteur fluide).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="space-y-8">
      {/* En-tête + solde */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            Offres &amp; crédits
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Les crédits servent aux recherches et aux analyses. Change d&apos;offre
            quand tu veux.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-border bg-surface shadow-card flex items-center gap-4 rounded-2xl border px-5 py-3"
        >
          <div>
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              Solde
            </p>
            <p className="text-primary flex items-center gap-1 text-2xl font-bold tabular-nums">
              <Zap size={20} className="fill-primary text-primary" />
              {formatCredits(balance)}
            </p>
          </div>
          <div className="border-border h-10 border-l" />
          <div>
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              Offre actuelle
            </p>
            <p className="text-lg font-bold">{planLabel(current)}</p>
          </div>
        </motion.div>
      </div>

      {/* Bandeau promo lancement */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 px-4 py-2 text-center text-sm font-semibold text-orange-700"
      >
        <Sparkles size={16} className="text-orange-500" />
        Offre de lancement — jusqu&apos;à −33&nbsp;% sur le 1<sup>er</sup> mois
      </motion.div>

      {/* Grille d'offres */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
        {PLAN_ORDER.map((p, i) => {
          const cfg = PLANS[p];
          const isCurrent = p === current;
          const isPopular = p === POPULAR;
          const isFree = cfg.priceNormal === 0;
          const pct =
            cfg.priceFirst != null
              ? discountPct(cfg.priceNormal, cfg.priceFirst)
              : 0;

          const features = [
            {
              icon: <Zap size={16} className="text-primary" />,
              label: (
                <>
                  <b className="text-foreground font-semibold">
                    {formatCredits(cfg.monthlyCredits)}
                  </b>{" "}
                  crédits / mois
                </>
              ),
              on: true,
            },
            {
              icon: <Users size={16} className="text-primary" />,
              label:
                cfg.competitorSlots === 0 ? (
                  "Pas de suivi concurrent"
                ) : (
                  <>
                    <b className="text-foreground font-semibold">
                      {cfg.competitorSlots}
                    </b>{" "}
                    concurrent{cfg.competitorSlots > 1 ? "s" : ""} suivi
                    {cfg.competitorSlots > 1 ? "s" : ""}
                  </>
                ),
              on: cfg.competitorSlots > 0,
            },
            {
              icon: <Bot size={16} className="text-primary" />,
              label: cfg.winnerEnabled ? (
                <>
                  Winner Agent —{" "}
                  <b className="text-foreground font-semibold">
                    {cfg.winnerKeywords} mots-clés
                  </b>{" "}
                  × {cfg.winnerCountries} pays
                </>
              ) : (
                "Winner Agent : non inclus"
              ),
              on: cfg.winnerEnabled,
            },
          ];

          return (
            <motion.div
              key={p}
              custom={i}
              variants={reveal}
              initial="hidden"
              animate="show"
              className={`relative flex flex-col rounded-3xl border p-6 ${
                isPopular
                  ? "border-primary/40 bg-gradient-to-b from-secondary/60 to-surface ring-primary shadow-xl shadow-primary/10 ring-2 lg:-my-2 lg:py-8"
                  : "border-border bg-surface shadow-card"
              }`}
            >
              {/* Badge populaire */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="from-primary inline-flex items-center gap-1 rounded-full bg-gradient-to-r to-blue-500 px-3 py-1 text-xs font-bold text-white shadow-md">
                    <Crown size={13} /> Populaire
                  </span>
                </div>
              )}

              {/* Nom + actuelle */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">{cfg.label}</h3>
                {isCurrent && (
                  <span className="bg-success-bg text-success rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    Actuelle
                  </span>
                )}
              </div>

              {/* Prix + promo */}
              <div className="min-h-[104px]">
                {isFree ? (
                  <>
                    <p className="text-4xl font-bold">Gratuit</p>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Pour découvrir Look360
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-muted-foreground text-base font-medium line-through">
                        {fcfa(cfg.priceNormal)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm">
                        <Sparkles size={11} />−{pct}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-primary text-4xl font-extrabold tabular-nums">
                        <NumberFlow
                          value={mounted ? (cfg.priceFirst ?? 0) : 0}
                          locales="fr-FR"
                        />
                      </span>
                      <span className="text-primary text-base font-bold">
                        FCFA
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs font-medium">
                      le 1<sup>er</sup> mois, puis {fcfa(cfg.priceNormal)}/mois
                    </p>
                  </>
                )}
              </div>

              {/* CTA */}
              <PlanButton isCurrent={isCurrent} isPopular={isPopular} />

              {/* Features */}
              <ul className="border-border mt-6 space-y-3 border-t pt-5">
                {features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-content-center rounded-full ${
                        f.on
                          ? "bg-secondary text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {f.on ? <Check size={13} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                    </span>
                    <span
                      className={f.on ? "text-muted-foreground" : "text-muted-foreground/70"}
                    >
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* Recharger des crédits */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold">Recharger des crédits</h2>
          <p className="text-muted-foreground text-sm">
            Un coup de boost ? Ajoute des crédits à ton solde — ils n&apos;expirent
            pas et s&apos;utilisent sur toutes les offres.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack, i) => (
            <motion.div
              key={pack.credits}
              custom={i}
              variants={reveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              className="border-border bg-surface shadow-card flex items-center justify-between gap-3 rounded-2xl border p-5"
            >
              <div>
                <p className="flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                  <Zap size={18} className="fill-primary text-primary" />
                  {formatCredits(pack.credits)}
                </p>
                <p className="text-muted-foreground text-sm">crédits</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-base font-bold">{fcfa(pack.price)}</p>
                <button
                  type="button"
                  disabled
                  title="Paiement bientôt disponible"
                  className="bg-input text-muted-foreground inline-flex min-h-[38px] cursor-not-allowed items-center justify-center rounded-full px-4 text-sm font-semibold"
                >
                  Bientôt disponible
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanButton({
  isCurrent,
  isPopular,
}: {
  isCurrent: boolean;
  isPopular: boolean;
}) {
  if (isCurrent) {
    return (
      <button
        type="button"
        disabled
        className="border-border text-muted-foreground mt-5 inline-flex min-h-[46px] w-full cursor-default items-center justify-center rounded-full border text-sm font-semibold"
      >
        Offre actuelle
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled
      title="Paiement bientôt disponible"
      className={`mt-5 inline-flex min-h-[46px] w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity ${
        isPopular
          ? "from-primary bg-gradient-to-t to-blue-500 text-white opacity-90 shadow-lg shadow-primary/25"
          : "bg-foreground/90 text-background opacity-85"
      }`}
    >
      Bientôt disponible <ArrowUpRight size={15} />
    </button>
  );
}
