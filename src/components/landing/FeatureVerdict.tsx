"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useInView, usePrefersReducedMotion, useCountUp } from "./anim";

/**
 * Verdict testing animé au scroll (utilisé dans la carte feature « Testing »).
 * Le closing se remplit, les stats apparaissent, le badge « Rentable » pop.
 */
export function FeatureVerdict() {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setStep(3);
      return;
    }
    const t = [
      setTimeout(() => setStep(1), 250),
      setTimeout(() => setStep(2), 1000),
      setTimeout(() => setStep(3), 1700),
    ];
    return () => t.forEach(clearTimeout);
  }, [inView, reduce]);

  const closing = useCountUp(70, step >= 1, reduce, 1000);
  const marge = useCountUp(74, step >= 2, reduce, 900);

  return (
    <div
      ref={ref}
      className="border-border bg-surface grid gap-5 rounded-xl border p-5 md:grid-cols-2"
    >
      {/* Colonne verdict */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
            Verdict du test
          </span>
          <span className="text-muted-foreground text-[11px]">
            Durée <span className="text-foreground font-bold">2 jours</span>
          </span>
        </div>

        <span
          className="bg-success-bg text-success mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
          style={{
            opacity: step >= 3 ? 1 : 0,
            transform: step >= 3 ? "scale(1)" : "scale(0.8)",
            transition:
              "opacity .35s ease, transform .45s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <span className="bg-success h-2 w-2 rounded-full" /> Rentable
        </span>

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-xs">
              Taux de closing
            </span>
            <span
              className="text-success text-xs font-semibold"
              style={{ opacity: closing >= 60 ? 1 : 0, transition: "opacity .3s" }}
            >
              Excellent
            </span>
          </div>
          <p className="text-success text-3xl font-extrabold tabular-nums">
            {closing} %
          </p>
          <div className="bg-input mt-1 h-2.5 overflow-hidden rounded-full">
            <div
              className="bg-success h-full rounded-full"
              style={{
                width: `${closing}%`,
                transition: reduce ? undefined : "width .1s linear",
              }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-[9px]">Objectif 60 %</p>
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-2"
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
      </div>

      {/* Colonne recommandation + chiffres réels */}
      <div className="flex flex-col gap-3">
        <div
          className="bg-secondary/50 text-foreground rounded-xl p-3 text-xs leading-relaxed"
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
        <div className="border-border grid grid-cols-2 gap-2 rounded-xl border p-3">
          <RealFig label="Commandes reçues" value="10" />
          <RealFig label="Confirmées" value="7" ok />
          <RealFig label="Prix de vente" value="20 000" />
          <RealFig label="Coût produit" value="2 700" />
        </div>
      </div>
    </div>
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

function RealFig({
  label,
  value,
  ok = false,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        ok ? "border-success/40 bg-success-bg/40" : "border-border bg-background"
      }`}
    >
      <p className="text-muted-foreground text-[9px]">{label}</p>
      <p className="text-foreground text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
