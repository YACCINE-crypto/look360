"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "motion/react";
import NumberFlow from "@number-flow/react";
import { Zap, Check, X, Sparkles, Crown, ArrowUpRight, Loader2 } from "lucide-react";
import {
  PLANS,
  CREDIT_PACKS,
  formatCredits,
  planLabel,
  type Plan,
} from "@/lib/billing";
import { startPayment } from "@/lib/pay";

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const discountPct = (normal: number, first: number) =>
  Math.round((1 - first / normal) * 100);

/** On ne montre en grand que les offres PAYANTES. Le Gratuit = bandeau discret. */
const PAID_ORDER: Plan[] = ["starter", "pro", "business"];
const POPULAR: Plan = "pro";

/** Baseline « montée en gamme » affichée sous le nom de chaque offre. */
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
    { label: "Vitrine des winners validés", on: true },
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
  payReturnRef,
}: {
  current: Plan;
  balance: number;
  payReturnRef?: string | null;
}) {
  const router = useRouter();

  // Démarre les prix à 0 puis anime vers la vraie valeur (compteur fluide).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Bouton en cours (clé = plan ou "pack:<credits>"), + message d'erreur.
  const [busy, setBusy] = useState<string | null>(null);
  const [payError, setPayError] = useState(false);

  const pay = useCallback(
    async (key: string, body: Parameters<typeof startPayment>[0]) => {
      setBusy(key);
      setPayError(false);
      const res = await startPayment(body);
      if (!res.ok) {
        setPayError(true);
        setBusy(null);
      }
      // Si ok : redirection vers le checkout (la page se décharge).
    },
    [],
  );

  // Retour de paiement : sonde le statut jusqu'à confirmation du webhook.
  const [payReturn, setPayReturn] = useState<
    "idle" | "pending" | "success" | "failed"
  >(payReturnRef ? "pending" : "idle");

  useEffect(() => {
    if (!payReturnRef) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      tries++;
      try {
        const r = await fetch(
          `/api/payments/status?ref=${encodeURIComponent(payReturnRef)}`,
        );
        const d = (await r.json()) as { status?: string };
        if (d.status === "success") {
          setPayReturn("success");
          router.refresh(); // rafraîchit solde + offre (server components)
          return;
        }
        if (d.status === "failed") {
          setPayReturn("failed");
          return;
        }
      } catch {
        /* réseau — on réessaie */
      }
      if (!stop && tries < 20) setTimeout(tick, 3000);
      else if (!stop) setPayReturn("failed");
    };
    tick();
    return () => {
      stop = true;
    };
  }, [payReturnRef, router]);

  return (
    <div className="space-y-7">
      {payReturn !== "idle" && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            payReturn === "success"
              ? "bg-success-bg text-success border-success/30"
              : payReturn === "failed"
                ? "bg-danger-bg text-danger border-danger/30"
                : "bg-secondary text-secondary-foreground border-primary/20"
          }`}
        >
          {payReturn === "pending" && <Loader2 size={16} className="animate-spin" />}
          {payReturn === "success" && <Check size={16} />}
          {payReturn === "pending" &&
            "Paiement reçu — validation en cours, ton solde se met à jour…"}
          {payReturn === "success" &&
            "Paiement confirmé ! Ton offre et ton solde sont à jour."}
          {payReturn === "failed" &&
            "On n'a pas encore pu confirmer ce paiement. S'il a été débité, ton solde se mettra à jour dès réception — sinon réessaie."}
        </div>
      )}
      {payError && (
        <div className="bg-danger-bg text-danger border-danger/30 rounded-xl border p-3 text-sm">
          Le paiement n&apos;a pas pu démarrer. Réessaie dans un instant.
        </div>
      )}
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          Offres &amp; crédits
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Les crédits servent aux recherches et aux analyses. Change d&apos;offre
          quand tu veux.
        </p>
      </div>

      {/* Bandeau discret — offre actuelle (Gratuit ou autre) + solde */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border-border bg-surface shadow-card flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-2.5 text-sm"
      >
        <span className="text-muted-foreground">Ton offre actuelle :</span>
        <span className="font-bold">{planLabel(current)}</span>
        <span className="text-muted-foreground">
          — {formatCredits(PLANS[current].monthlyCredits)} crédits / mois
        </span>
        <span className="text-border mx-1">·</span>
        <span className="text-primary inline-flex items-center gap-1 font-semibold">
          <Zap size={14} className="fill-primary text-primary" /> Solde{" "}
          {formatCredits(balance)}
        </span>
      </motion.div>

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

      {/* Grille des 3 offres payantes */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:items-stretch">
        {PAID_ORDER.map((p, i) => {
          const cfg = PLANS[p];
          const isCurrent = p === current;
          const isPopular = p === POPULAR;
          const pct =
            cfg.priceFirst != null
              ? discountPct(cfg.priceNormal, cfg.priceFirst)
              : 0;

          return (
            <motion.div
              key={p}
              custom={i}
              variants={reveal}
              initial="hidden"
              animate="show"
              className={`relative flex flex-col rounded-3xl border p-6 ${
                isPopular
                  ? "border-primary/40 bg-gradient-to-b from-secondary/60 to-surface ring-primary shadow-xl shadow-primary/10 ring-2 md:-my-2 md:py-8"
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

              {/* Nom + tagline + actuelle */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{cfg.label}</h3>
                  {isCurrent && (
                    <span className="bg-success-bg text-success rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      Actuelle
                    </span>
                  )}
                </div>
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
                  <span className="text-primary text-base font-bold">FCFA</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs font-medium">
                  le 1<sup>er</sup> mois, puis {fcfa(cfg.priceNormal)}/mois
                </p>
              </div>

              {/* CTA */}
              <PlanButton
                isCurrent={isCurrent}
                isPopular={isPopular}
                busy={busy === p}
                onClick={() =>
                  pay(p, {
                    purpose: "subscription",
                    plan: p as "starter" | "pro" | "business",
                  })
                }
              />

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
                        <Check size={13} strokeWidth={3} />
                      ) : (
                        <X size={12} strokeWidth={3} />
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
              className="border-border bg-surface shadow-card flex flex-col items-center gap-3 rounded-2xl border p-5 text-center"
            >
              <div>
                <p className="flex items-center justify-center gap-1.5 text-2xl font-bold tabular-nums whitespace-nowrap">
                  <Zap size={18} className="fill-primary text-primary" />
                  {formatCredits(pack.credits)}
                </p>
                <p className="text-muted-foreground text-sm">crédits</p>
              </div>
              <p className="text-lg font-bold">{fcfa(pack.price)}</p>
              <button
                type="button"
                onClick={() =>
                  pay(`pack:${pack.credits}`, {
                    purpose: "credit_pack",
                    packCredits: pack.credits,
                  })
                }
                disabled={busy === `pack:${pack.credits}`}
                className="bg-primary text-primary-foreground inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy === `pack:${pack.credits}` ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Redirection…
                  </>
                ) : (
                  "Recharger"
                )}
              </button>
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
  busy,
  onClick,
}: {
  isCurrent: boolean;
  isPopular: boolean;
  busy: boolean;
  onClick: () => void;
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
      onClick={onClick}
      disabled={busy}
      className={`mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-70 ${
        isPopular
          ? "from-primary bg-gradient-to-t to-blue-500 text-white shadow-lg shadow-primary/25"
          : "bg-foreground text-background"
      }`}
    >
      {busy ? (
        <>
          <Loader2 size={15} className="animate-spin" /> Redirection…
        </>
      ) : (
        <>
          Choisir cette offre <ArrowUpRight size={15} />
        </>
      )}
    </button>
  );
}
