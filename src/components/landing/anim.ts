"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Vrai dès que l'élément entre à l'écran (une seule fois). */
export function useInView<T extends Element>(
  threshold = 0.3,
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
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
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/** True si l'utilisateur préfère réduire les animations. */
export function usePrefersReducedMotion(): boolean {
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

/** Compteur animé 0 → target (rAF léger), déclenché par `active`. */
export function useCountUp(
  target: number,
  active: boolean,
  reduce: boolean,
  duration = 900,
): number {
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
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduce, duration]);
  return v;
}
