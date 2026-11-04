"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export const NAV_LINKS = [
  { href: "#etapes", label: "Comment ça marche" },
  { href: "#fonctions", label: "Fonctions" },
  { href: "#comparatif", label: "Comparatif" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

/** Nav flottante de la landing : liens au centre, repliée en menu sur mobile. */
export function NuitNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="nav-in">
        <Link href="/" className="nav-logo" aria-label="Look360 — accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/look360-logo-light.svg" alt="Look360" width={126} height={34} />
        </Link>
        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="nav-r">
          <Link className="btn" href="/login">
            Connexion
          </Link>
          <Link className="btn btn-primary" href="/login?tab=signup">
            <span className="lg">Commencer gratuitement</span>
            <span className="sm">Essai gratuit</span>
          </Link>
          <button
            type="button"
            className="burger"
            aria-expanded={open}
            aria-controls="nuit-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? "x" : "menu"} size={20} />
          </button>
        </div>
      </div>
      {open && (
        <div id="nuit-menu" className="menu">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Connexion
          </Link>
        </div>
      )}
    </nav>
  );
}
