"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: "today" as const },
  { href: "/recherche", label: "Recherche", icon: "search" as const },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" as const },
  { href: "/testing", label: "Testing", icon: "flask" as const },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
}

/** Navigation latérale (desktop). */
export function SidebarNav() {
  const isActive = useActive();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-input hover:text-foreground"
            }`}
          >
            <Icon name={it.icon} size={18} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre de navigation basse (mobile). */
export function BottomNav() {
  const isActive = useActive();
  return (
    <nav className="border-border bg-surface fixed inset-x-0 bottom-0 z-20 flex border-t md:hidden">
      {ITEMS.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon name={it.icon} size={20} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
