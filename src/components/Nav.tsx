"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: "today" as const },
  { href: "/recherche", label: "Recherche", icon: "search" as const },
  { href: "/spy", label: "Spy Facebook", icon: "eye" as const },
  { href: "/winners", label: "Winners du jour", icon: "trophy" as const },
  { href: "/top-trend", label: "Top Trend", icon: "trending" as const },
  { href: "/sauvegardes", label: "Sauvegardés", icon: "bookmark" as const },
  { href: "/surveillance", label: "Surveillance", icon: "bell" as const },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" as const },
  { href: "/testing", label: "Testing", icon: "flask" as const },
  { href: "/angles", label: "Angles", icon: "tag" as const },
  { href: "/validation", label: "Validation", icon: "inbox" as const, adminOnly: true },
  { href: "/equipe", label: "Équipe", icon: "users" as const, adminOnly: true },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
}

/** Navigation latérale — desktop (sidebar) et drawer mobile.
 *  `onNavigate` ferme le panneau mobile au clic sur un lien. */
export function SidebarNav({
  onNavigate,
  isAdmin = false,
  pendingCount = 0,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
  pendingCount?: number;
}) {
  const isActive = useActive();
  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.filter((it) => !it.adminOnly || isAdmin).map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            className={`flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-secondary text-primary font-medium"
                : "text-muted-foreground hover:bg-input hover:text-foreground"
            }`}
          >
            <Icon name={it.icon} size={18} className="shrink-0" />
            <span className="flex-1">{it.label}</span>
            {it.href === "/validation" && pendingCount > 0 && (
              <span className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 py-0.5 text-xs font-semibold">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
