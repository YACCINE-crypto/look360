"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { logout } from "@/app/login/actions";

/* eslint-disable @next/next/no-img-element */

const NAV = [
  { href: "/admin", label: "Cockpit", icon: "trending" as const },
  { href: "/admin/clients", label: "Clients", icon: "users" as const },
  { href: "/admin/revenus", label: "Revenus & marge", icon: "store" as const },
  { href: "/admin/activite", label: "Activité", icon: "bell" as const },
  { href: "/admin/reglages", label: "Réglages", icon: "settings" as const },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((it) => {
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

function Sidebar({
  displayName,
  onClose,
}: {
  displayName: string;
  onClose?: () => void;
}) {
  return (
    <aside className="border-border bg-surface flex h-full w-sidebar flex-col border-r">
      <div className="border-border flex items-center justify-between border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <img src="/look360-icon.svg" alt="Look360" className="h-7 w-7" />
          <span className="text-foreground text-sm font-bold">
            Admin<span className="text-primary">·</span>360
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground -mr-2 inline-flex h-11 w-11 items-center justify-center lg:hidden"
            aria-label="Fermer le menu"
          >
            <Icon name="x" size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <NavLinks onNavigate={onClose} />
      </div>

      <div className="border-border border-t px-3 py-3">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold">
            {displayName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-muted-foreground text-xs">Superadmin</p>
          </div>
        </div>
        <Link
          href="/aujourdhui"
          onClick={onClose}
          className="text-muted-foreground hover:bg-input hover:text-foreground flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
        >
          <Icon name="chevronRight" size={16} className="rotate-180" />
          Retour à l&apos;app
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="text-muted-foreground hover:bg-input hover:text-danger flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
          >
            <Icon name="logout" size={16} />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}

export function AdminShell({
  displayName,
  children,
}: {
  displayName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-background min-h-screen">
      {/* Sidebar desktop */}
      <div className="fixed inset-y-0 left-0 hidden lg:block">
        <Sidebar displayName={displayName} />
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="animate-sheet-in absolute inset-y-0 left-0">
            <Sidebar displayName={displayName} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Contenu */}
      <div className="lg:pl-sidebar">
        {/* Topbar mobile */}
        <header className="border-border bg-surface sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="text-foreground hover:bg-input inline-flex h-11 w-11 items-center justify-center rounded-lg"
            aria-label="Ouvrir le menu"
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="text-sm font-bold">
            Admin<span className="text-primary">·</span>360
          </span>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
