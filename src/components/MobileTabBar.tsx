"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

type IconName = Parameters<typeof Icon>[0]["name"];

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/recherche", label: "Recherche", icon: "search" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/winners", label: "Winners", icon: "trophy" },
  { href: "/vitrine", label: "Vitrine", icon: "store" },
];

/**
 * Barre d'onglets basse — feel appli native (mobile uniquement, < lg).
 * 4 raccourcis + bouton Menu (ouvre le drawer complet). Respecte la safe-area.
 */
export function MobileTabBar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t shadow-[0_-1px_3px_rgba(15,23,42,0.05)] backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span
                className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                  active ? "bg-secondary" : "bg-transparent"
                }`}
              >
                <Icon name={t.icon} size={19} />
              </span>
              {t.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenu}
          className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium"
          aria-label="Ouvrir le menu"
        >
          <span className="grid h-7 w-12 place-items-center rounded-full">
            <Icon name="menu" size={19} />
          </span>
          Menu
        </button>
      </div>
    </nav>
  );
}
