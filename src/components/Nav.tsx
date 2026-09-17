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

/** Navigation latérale — desktop (sidebar) et drawer mobile.
 *  `onNavigate` ferme le panneau mobile au clic sur un lien. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const isActive = useActive();
  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map((it) => {
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
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
