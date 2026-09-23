"use client";

import { useState } from "react";
import { SidebarNav } from "./Nav";
import { Icon } from "./Icon";
import { NotifBell } from "./NotifBell";
import { logout } from "@/app/login/actions";

/**
 * Coquille d'application — système de layout Kimba.
 * Desktop (≥ lg / 1024px) : sidebar fixe 224px.
 * Mobile : topbar + menu hamburger → panneau latéral overlay (drawer).
 * Thème (couleurs/police) = Look360, inchangé.
 */

function Brand({ compact = false }: { compact?: boolean }) {
  // Mobile compact : icône seule. Desktop : logo complet (icône + nom).
  return compact ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/look360-icon.svg" alt="Look360" className="h-8 w-8" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/look360-logo.svg" alt="Look360" className="h-8 w-auto" />
  );
}

function Sidebar({
  displayName,
  initials,
  role,
  isAdmin,
  pendingCount,
  onClose,
}: {
  displayName: string;
  initials: string;
  role: string;
  isAdmin: boolean;
  pendingCount: number;
  onClose?: () => void;
}) {
  return (
    <aside className="border-border bg-surface flex h-full w-sidebar flex-col border-r">
      {/* Marque */}
      <div className="border-border flex items-center justify-between border-b px-4 py-4">
        <Brand />
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <SidebarNav
          onNavigate={onClose}
          isAdmin={isAdmin}
          pendingCount={pendingCount}
        />
      </nav>

      {/* Profil */}
      <div className="border-border border-t px-3 py-3">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="bg-secondary text-secondary-foreground grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-muted-foreground text-xs capitalize">{role}</p>
          </div>
        </div>
        <NotifBell />
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

export function AppShell({
  children,
  displayName,
  initials,
  role,
  pendingCount = 0,
}: {
  children: React.ReactNode;
  displayName: string;
  initials: string;
  role: string;
  pendingCount?: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = role === "superadmin";

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden h-full lg:flex">
        <Sidebar
          displayName={displayName}
          initials={initials}
          role={role}
          isAdmin={isAdmin}
          pendingCount={pendingCount}
        />
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="animate-sheet-in relative h-full w-sidebar">
            <Sidebar
              displayName={displayName}
              initials={initials}
              role={role}
              isAdmin={isAdmin}
              pendingCount={pendingCount}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar mobile */}
        <header className="border-border bg-surface flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground -ml-2 inline-flex h-11 w-11 items-center justify-center"
            aria-label="Ouvrir le menu"
          >
            <Icon name="menu" size={22} />
          </button>
          <Brand compact />
          <div className="h-11 w-11" aria-hidden="true" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
