"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

/* eslint-disable @next/next/no-img-element */

const LINKS = [
  { href: "#fonctions", label: "Fonctions" },
  { href: "#comparatif", label: "Comparatif" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

/**
 * Barre de navigation de la landing.
 * - Sticky, avec léger « morph » au scroll (fond + ombre qui apparaissent).
 * - Liens d'ancre desktop ; menu burger sur mobile.
 * - CTA principal « Commencer gratuitement » → /signup.
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-border bg-surface/85 border-b shadow-sm backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center" aria-label="Look360 — accueil">
          <img src="/look360-logo.svg" alt="Look360" className="h-7 w-auto" />
        </Link>

        {/* Liens d'ancre — desktop */}
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Actions — desktop */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="text-foreground hover:bg-input rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
          >
            Commencer gratuitement
          </Link>
        </div>

        {/* Burger — mobile */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-foreground hover:bg-input -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg md:hidden"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
        >
          <Icon name={open ? "x" : "menu"} size={22} />
        </button>
      </nav>

      {/* Panneau mobile */}
      {open && (
        <div className="border-border bg-surface border-t md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-foreground hover:bg-input rounded-lg px-3 py-2.5 text-sm font-medium"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="border-border text-foreground rounded-lg border px-3 py-2.5 text-center text-sm font-semibold"
              >
                Connexion
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="bg-primary text-primary-foreground rounded-lg px-3 py-2.5 text-center text-sm font-semibold"
              >
                Commencer gratuitement
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
