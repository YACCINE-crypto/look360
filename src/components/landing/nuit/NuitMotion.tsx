"use client";

import { useEffect } from "react";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/**
 * Moteur d'animations de la landing « Nuit » (repris du fichier de référence) :
 * pluie de données en fond, révélations au scroll (.rv → .in), compteurs
 * (data-count), boucle de l'étape 1 (la gagnante ressort), curseur de l'étape 2,
 * capture qui se redresse au scroll. Rien ne tourne si l'utilisateur a demandé
 * moins d'animations ; la pluie est coupée sur mobile (performance).
 */
export function NuitMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".nuit");
    if (!root) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const intervals: number[] = [];
    const cleanups: (() => void)[] = [];

    // --- Compteurs ---
    const countUp = (el: HTMLElement) => {
      const end = Number(el.dataset.count);
      if (!Number.isFinite(end) || el.dataset.done) return;
      el.dataset.done = "1";
      if (reduce || end === 0) {
        el.textContent = fmt(end);
        return;
      }
      const t0 = performance.now();
      const d = 1400;
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / d);
        el.textContent = fmt(Math.round(end * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    // --- Étape 2 : le curseur clique « Envoyer en test », en boucle ---
    const clickLoop = () => {
      const c = root.querySelector<SVGElement>("[data-cursor]");
      const b = root.querySelector<HTMLElement>("[data-press]");
      if (!c || !b || reduce) return;
      const label = b.textContent ?? "";
      const run = () => {
        c.style.left = "48%";
        c.style.top = "62px";
        timers.push(window.setTimeout(() => { b.classList.add("press"); b.textContent = "✓ ENVOYÉ EN TEST"; }, 1050));
        timers.push(window.setTimeout(() => b.classList.remove("press"), 1250));
        timers.push(window.setTimeout(() => { c.style.left = "80%"; c.style.top = "-40px"; b.textContent = label; }, 3200));
      };
      run();
      intervals.push(window.setInterval(run, 4800));
    };

    // --- Révélations + déclencheurs au scroll ---
    // Le fondu n'est activé qu'ici : sans JavaScript, tout reste visible.
    if (!reduce) root.classList.add("motion");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          el.classList.add("in");
          el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
          if (el.hasAttribute("data-step2")) clickLoop();
          io.unobserve(el);
        }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    root.querySelectorAll(".rv, [data-in]").forEach((el) => io.observe(el));
    root.querySelectorAll<HTMLElement>("[data-count-now]").forEach(countUp);
    cleanups.push(() => io.disconnect());

    // --- Étape 1 : scan puis la gagnante ressort, en boucle ---
    const s1 = root.querySelector<HTMLElement>("[data-step1]");
    const s1t = root.querySelector<HTMLElement>("[data-step1-title]");
    if (s1) {
      const idle = s1t?.textContent ?? "";
      const win = s1t?.dataset.win ?? idle;
      const toggle = () => {
        const on = s1.classList.toggle("pick");
        if (s1t) s1t.textContent = on ? win : idle;
      };
      if (reduce) toggle();
      else intervals.push(window.setInterval(toggle, 3200));
    }

    // --- Capture : se redresse au scroll ---
    const frame = root.querySelector<HTMLElement>("[data-tilt]");
    if (frame && !reduce) {
      let raf = 0;
      const onScroll = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = frame.getBoundingClientRect();
          const k = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * 0.8)));
          frame.style.setProperty("--tilt", `${(22 - 22 * k).toFixed(2)}deg`);
          frame.style.setProperty("--sc", (0.92 + 0.08 * k).toFixed(3));
        });
      };
      onScroll();
      addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => removeEventListener("scroll", onScroll));
    } else if (frame) {
      frame.style.setProperty("--tilt", "0deg");
      frame.style.setProperty("--sc", "1");
    }

    // --- Pluie de données (mobile : densité réduite et 30 i/s pour la batterie) ---
    const cv = root.querySelector<HTMLCanvasElement>("canvas.rain");
    const ctx = cv?.getContext("2d");
    if (cv && ctx && !reduce) {
      const mobile = innerWidth <= 768;
      const color = getComputedStyle(root).getPropertyValue("--night-accent-sky").trim() || "currentColor";
      let drops: { x: number; y: number; l: number; v: number; o: number }[] = [];
      const dpr = mobile ? 1 : Math.min(2, devicePixelRatio || 1);
      const size = () => {
        cv.width = innerWidth * dpr;
        cv.height = innerHeight * dpr;
        drops = Array.from({ length: Math.round(innerWidth / (mobile ? 22 : 16)) }, () => ({
          x: Math.random() * cv.width,
          y: Math.random() * cv.height,
          l: 8 + Math.random() * 22,
          v: 0.6 + Math.random() * 1.8,
          o: 0.08 + Math.random() * 0.2,
        }));
      };
      size();
      addEventListener("resize", size);
      let raf = 0;
      let visible = true;
      const onVis = () => (visible = document.visibilityState === "visible");
      document.addEventListener("visibilitychange", onVis);
      let last = 0;
      const step = mobile ? 2 : 1; // 30 i/s sur mobile → pas doublé, même vitesse perçue
      const loop = (t = 0) => {
        raf = requestAnimationFrame(loop);
        if (!visible) return;
        if (mobile && t - last < 33) return;
        last = t;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = dpr;
        for (const d of drops) {
          ctx.globalAlpha = d.o;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x, d.y + d.l * dpr);
          ctx.stroke();
          d.y += d.v * dpr * step;
          if (d.y > cv.height) {
            d.y = -30;
            d.x = Math.random() * cv.width;
          }
        }
      };
      loop();
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        removeEventListener("resize", size);
        document.removeEventListener("visibilitychange", onVis);
      });
    }

    return () => {
      root.classList.remove("motion");
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      cleanups.forEach((f) => f());
    };
  }, []);

  return null;
}
