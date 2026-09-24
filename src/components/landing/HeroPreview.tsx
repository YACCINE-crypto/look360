"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/* Vidéo de démo (Bunny Stream) — URL en variable d'env publique. Rien n'est
   chargé tant que l'utilisateur ne clique pas sur « Voir la démo ». */
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

/** Compteur animé 0 → target (léger, rAF), déclenché par `active`. */
function useCountUp(target: number, active: boolean, reduce: boolean, duration = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduce, duration]);
  return v;
}

/**
 * Aperçu d'interface Look360 (grille Spy + verdict testing), animé au scroll.
 * - Scores qui montent, lignes Testing qui apparaissent une par une, verdict
 *   « Rentable » qui pop. Intersection Observer, respecte prefers-reduced-motion.
 * - Bouton « Voir la démo » : ouvre une lightbox vidéo Bunny UNIQUEMENT au clic
 *   (l'iframe n'est montée qu'à l'ouverture → zéro poids au chargement).
 */
export function HeroPreview() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduce = usePrefersReducedMotion();
  const [inView, setInView] = useState(false);
  const [step, setStep] = useState(0); // 0 → 4 : commandes, closing, marge, verdict
  const [open, setOpen] = useState(false);

  // Déclenche l'animation quand le mockup entre à l'écran (une seule fois).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Révélation en cascade des lignes Testing puis du verdict.
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setStep(4);
      return;
    }
    const timers = [1, 2, 3, 4].map((s, i) =>
      setTimeout(() => setStep(s), 700 + i * 420),
    );
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  const scores = [92, 78, 85, 64];

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-4xl">
      <div className="border-border bg-surface overflow-hidden rounded-2xl border shadow-xl shadow-primary/5">
        {/* Barre de fenêtre */}
        <div className="border-border bg-background flex items-center gap-2 border-b px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <div className="bg-input text-muted-foreground ml-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs">
            <Icon name="eye" size={12} /> Spy Facebook · Côte d&apos;Ivoire
          </div>
        </div>

        {/* Corps : grille spy + panneau verdict */}
        <div className="grid gap-4 p-4 sm:grid-cols-5">
          {/* Grille Spy — scores animés */}
          <div className="grid grid-cols-2 gap-3 sm:col-span-3">
            {scores.map((s, i) => (
              <SpyMiniCard key={i} score={s} active={inView} reduce={reduce} />
            ))}
          </div>

          {/* Panneau Testing / verdict — révélation en cascade */}
          <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4 sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <span className="text-primary">
                <Icon name="flask" size={14} />
              </span>
              <p className="text-muted-foreground text-xs font-medium">Testing COD</p>
            </div>

            <div className="space-y-2.5">
              <StatRow label="Commandes reçues" value="14" show={step >= 1} />
              <StatRow label="Taux de closing" value="62 %" accent show={step >= 2} />
              <StatRow label="Marge nette" value="+48 %" accent show={step >= 3} />
            </div>

            <span
              className="bg-success-bg text-success mt-1 inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-sm font-bold"
              style={{
                opacity: step >= 4 ? 1 : 0,
                transform: step >= 4 ? "scale(1)" : "scale(0.8)",
                transition: "opacity .35s ease, transform .45s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              <Icon name="check" size={14} strokeWidth={3} /> Rentable
            </span>
          </div>
        </div>
      </div>

      {/* Bouton démo + légende */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-border bg-surface text-foreground hover:bg-input shadow-card inline-flex min-h-[44px] items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors"
        >
          <span className="bg-primary text-primary-foreground grid h-6 w-6 place-items-center rounded-full">
            <Icon name="play" size={12} />
          </span>
          Voir la démo (30s)
        </button>
        <p className="text-muted-foreground text-xs">Aperçu de l&apos;interface Look360</p>
      </div>

      {open && <DemoLightbox onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ---------------------------------------------------------- carte spy mini */

function SpyMiniCard({
  score,
  active,
  reduce,
}: {
  score: number;
  active: boolean;
  reduce: boolean;
}) {
  const v = useCountUp(score, active, reduce);
  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="bg-input text-muted-foreground flex aspect-video items-center justify-center">
        <Icon name="image" size={20} />
      </div>
      <div className="p-2">
        <div className="bg-muted h-2 w-3/4 rounded-full" />
        <div className="mt-2 flex items-center justify-between">
          <span className="bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            Score {v}
          </span>
          <span className="text-success">
            <Icon name="trending" size={13} />
          </span>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent = false,
  show,
}: {
  label: string;
  value: string;
  accent?: boolean;
  show: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(6px)",
        transition: "opacity .4s ease, transform .4s ease",
      }}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={`text-sm font-bold tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- lightbox */

function DemoLightbox({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Échap pour fermer + verrou du scroll + focus sur le bouton fermer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Démo Look360"
      onClick={onClose}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div onClick={stop} className="relative w-full max-w-3xl">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer la démo"
          className="absolute -top-11 right-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <Icon name="x" size={20} />
        </button>

        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
          {DEMO_URL ? (
            <iframe
              src={DEMO_URL}
              title="Démo Look360"
              loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <div className="text-muted-foreground absolute inset-0 grid place-items-center bg-surface p-6 text-center text-sm">
              La démo vidéo sera disponible très bientôt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
