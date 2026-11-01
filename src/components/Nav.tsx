"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { planConfig } from "@/lib/billing";

const ITEMS = [
  { href: "/recherche", label: "Feed du jour", icon: "today" as const, group: "Trouver" },
  { href: "/spy", label: "Spy Facebook", icon: "eye" as const, group: "Trouver" },
  { href: "/boutiques", label: "Boutiques & produits", icon: "store" as const, group: "Trouver" },
  { href: "/top-trend", label: "Top Trend", icon: "trending" as const, needs: "paid" as const, group: "Trouver" },
  { href: "/winners", label: "Winners du jour", icon: "trophy" as const, needs: "winner" as const, group: "Trouver" },
  { href: "/produits", label: "Mes produits", icon: "pipeline" as const, group: "Suivre" },
  { href: "/surveillance", label: "Surveillance", icon: "bell" as const, needs: "competitor" as const, group: "Suivre" },
  { href: "/testing", label: "Testing", icon: "flask" as const, group: "Suivre" },
  { href: "/vitrine", label: "Vitrine winners", icon: "trophy" as const, needs: "vitrine" as const, group: "Suivre" },
  { href: "/validation", label: "Validation", icon: "inbox" as const, adminOnly: true, group: "Admin" },
  { href: "/equipe", label: "Équipe", icon: "users" as const, adminOnly: true, group: "Admin" },
];
const GROUPS = ["Trouver", "Suivre", "Admin"] as const;

/** Une fonctionnalité est-elle verrouillée pour cette offre ? */
function isLocked(needs: string | undefined, plan: string): boolean {
  if (!needs) return false;
  if (needs === "paid") return plan === "free";
  const cfg = planConfig(plan);
  if (needs === "winner") return !cfg.winnerEnabled;
  if (needs === "competitor") return cfg.competitorSlots === 0;
  if (needs === "vitrine") return !cfg.vitrineEnabled;
  return false;
}

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
  plan = "free",
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
  pendingCount?: number;
  plan?: string;
}) {
  const isActive = useActive();
  return (
    <nav className="flex flex-col gap-4">
      {GROUPS.filter((g) => g !== "Admin" || isAdmin).map((g) => (
        <div key={g} className="flex flex-col gap-0.5">
          <p className="text-sidebar-muted px-3 pb-1 text-xs font-medium uppercase tracking-wider">{g}</p>
      {ITEMS.filter((it) => it.group === g && (!it.adminOnly || isAdmin)).map((it) => {
        const active = isActive(it.href);
        const locked = isLocked(it.needs, plan);
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            className={`relative flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
              active
                ? "bg-sidebar-active-bg text-sidebar-active-fg font-semibold before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-accent-light"
                : "text-sidebar-muted hover:bg-sidebar-hover-bg hover:text-sidebar-fg"
            }`}
          >
            <Icon name={it.icon} size={18} className="shrink-0" />
            <span className={`flex-1 ${locked ? "opacity-70" : ""}`}>{it.label}</span>
            {locked && (
              <Icon
                name="lock"
                size={13}
                className="text-sidebar-muted ml-auto shrink-0"
                aria-label="Réservé à une offre supérieure"
              />
            )}
            {it.href === "/validation" && pendingCount > 0 && (
              <span className="bg-accent text-accent-on ml-auto rounded-full px-1.5 py-0.5 text-xs font-semibold">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
        </div>
      ))}
    </nav>
  );
}
