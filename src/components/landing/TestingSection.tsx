"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";
import { useInView, usePrefersReducedMotion, useCountUp } from "./anim";

/**
 * STEP 4 — Section Testing signature (forte mise en avant).
 * Carte verdict animée au scroll : le closing se remplit, la marge apparaît,
 * puis le verdict « Rentable » pop. Respecte prefers-reduced-motion.
 */
export function TestingSection() {
  return (
    <section
      id="testing"
      className="from-secondary/30 via-surface to-surface scroll-mt-20 bg-gradient-to-br px-4 py-12 sm:px-6 sm:py-20"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
        {/* Colonne texte */}
        <RevealOnScroll>
          <div>
            <span className="border-primary/20 bg-surface text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold">
              <Icon name="flask" size={13} /> La fonction signature
            </span>

            <h2 className="text-foreground mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Le testing, c&apos;est ça la vraie différence.
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed">
              Avant d&apos;investir, tu sais. Taux de closing, marge nette,
              verdict — calculés sur tes vraies commandes, pas sur des
              suppositions.
            </p>

            {/* Comment ça marche */}
            <ul className="mt-6 space-y-4">
              <Step
                icon="inbox"
                title="Tes commandes → ton taux de closing"
                body="Tu entres tes commandes reçues et confirmées, Look360 calcule ton taux de closing COD réel."
              />
              <Step
                icon="trending"
                title="Projection de la marge nette"
                body="Prix − coût produit − livraison : tu vois ta marge réelle avant de commander du stock."
              />
              <Step
                icon="check"
                title="Un verdict clair"
                body={
                  <>
                    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Dot c="bg-success" label="rentable" />
                      <Dot c="bg-warning" label="moyen" />
                      <Dot c="bg-danger" label="pas rentable" />
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      Valable dès 10 commandes reçues.
                    </span>
                  </>
                }
              />
            </ul>

            <p className="text-foreground mt-6 text-lg font-bold">
              Fini le pari. Tu investis avec des chiffres, pas avec ton
              intuition.
            </p>
          </div>
        </RevealOnScroll>

        {/* Colonne verdict animé */}
        <VerdictLive />
      </div>
    </section>
  );
}

function Step({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="bg-secondary text-primary grid h-9 w-9 shrink-0 place-items-center rounded-lg">
        <Icon name={icon} size={17} />
      </span>
      <div>
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <div className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
          {body}
        </div>
      </div>
    </li>
  );
}

function Dot({ c, label }: { c: string; label: string }) {
  return (
    <span className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium">
      <span className={`h-2.5 w-2.5 rounded-full ${c}`} /> {label}
    </span>
  );
}

/* ------------------------------------------------- carte verdict animée */

function VerdictLive() {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(0); // 1 closing · 2 stats · 3 verdict

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setStep(3);
      return;
    }
    const t = [
      setTimeout(() => setStep(1), 250),
      setTimeout(() => setStep(2), 1100),
      setTimeout(() => setStep(3), 1900),
    ];
    return () => t.forEach(clearTimeout);
  }, [inView, reduce]);

  const closing = useCountUp(70, step >= 1, reduce, 1000);
  const marge = useCountUp(74, step >= 2, reduce, 900);

  return (
    <RevealOnScroll delay={100}>
      <div
        ref={ref}
        className="border-border bg-surface shadow-xl shadow-primary/5 rounded-2xl border p-5 sm:p-6"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
            Verdict du test
          </span>
          <span className="text-muted-foreground text-[11px]">
            Durée <span className="text-foreground font-bold">2 jours</span>
          </span>
        </div>

        {/* Pastille verdict (pop en dernier) */}
        <span
          className="bg-success-bg text-success mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
          style={{
            opacity: step >= 3 ? 1 : 0,
            transform: step >= 3 ? "scale(1)" : "scale(0.8)",
            transition:
              "opacity .35s ease, transform .45s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span className="bg-success h-2 w-2 rounded-full" /> Rentable
        </span>

        {/* Taux de closing + barre */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-xs">
              Taux de confirmation (closing)
            </span>
            <span
              className="text-success text-xs font-semibold"
              style={{ opacity: closing >= 60 ? 1 : 0, transition: "opacity .3s" }}
            >
              Excellent closing
            </span>
          </div>
          <p className="text-success text-4xl font-extrabold tabular-nums">
            {closing} %
          </p>
          <div className="bg-input mt-1.5 h-3 overflow-hidden rounded-full">
            <div
              className="bg-success h-full rounded-full"
              style={{
                width: `${closing}%`,
                transition: reduce ? undefined : "width .1s linear",
              }}
            />
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
            <span>0 %</span>
            <span>Objectif 60 %</span>
            <span>100 %</span>
          </div>
        </div>

        {/* Tuiles stats (apparaissent à l'étape 2) */}
        <div
          className="mt-5 grid grid-cols-2 gap-2.5"
          style={{
            opacity: step >= 2 ? 1 : 0,
            transform: step >= 2 ? "none" : "translateY(8px)",
            transition: "opacity .45s ease, transform .45s ease",
          }}
        >
          <Tile label="Bénéfice projeté" value="103 500" unit="FCFA" />
          <Tile label="Marge nette" value={`${marge} %`} unit="sur prix de vente" accent />
          <Tile label="ROAS" value="28.0x" unit="retour budget pub" amber />
          <Tile label="Budget pub" value="5 000" unit="FCFA" />
        </div>

        {/* Recommandation (étape 3) */}
        <div
          className="bg-secondary/50 text-foreground mt-4 rounded-xl p-3 text-xs leading-relaxed"
          style={{
            opacity: step >= 3 ? 1 : 0,
            transform: step >= 3 ? "none" : "translateY(8px)",
            transition: "opacity .45s ease .1s, transform .45s ease .1s",
          }}
        >
          <span className="text-primary font-bold">💡 Recommandation :</span> le
          taux de closing dépasse l&apos;objectif et la marge est solide. Ce
          produit est prêt pour la production.
        </div>
      </div>
    </RevealOnScroll>
  );
}

function Tile({
  label,
  value,
  unit,
  accent = false,
  amber = false,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  amber?: boolean;
}) {
  return (
    <div className="bg-background rounded-lg p-2.5">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p
        className={`text-base font-extrabold tabular-nums ${
          accent ? "text-success" : amber ? "text-warning" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="text-muted-foreground text-[9px]">{unit}</p>
    </div>
  );
}
