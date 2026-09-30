"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleUser, LogOut } from "lucide-react";
import { SidebarNav } from "./Nav";
import { Icon } from "./Icon";
import { MobileTabBar } from "./MobileTabBar";
import { logout } from "@/app/login/actions";
import { formatCredits, planLabel } from "@/lib/billing";

/** Pastille solde de crédits + offre — cliquable vers la page d'offres. */
function CreditsBadge({ credits, plan, compact = false }: { credits: number; plan: string; compact?: boolean }) {
  return (
    <Link
      href="/offres"
      className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-90"
      title={`${formatCredits(credits)} crédits · offre ${planLabel(plan)}`}
    >
      <span>⚡ {formatCredits(credits)}</span>
      {!compact && <span className="opacity-70">· {planLabel(plan)}</span>}
    </Link>
  );
}

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
  isAdmin,
  pendingCount,
  plan,
  onClose,
}: {
  displayName: string;
  initials?: string;
  role?: string;
  isAdmin: boolean;
  pendingCount: number;
  credits?: number;
  plan: string;
  onClose?: () => void;
}) {
  return (
    <aside className="bg-sidebar-bg text-sidebar-fg border-sidebar-border flex h-full w-sidebar flex-col border-r">
      {/* Marque (wordmark blanc lisible sur navy) */}
      <div className="border-sidebar-border flex items-center justify-between border-b px-4 py-4">
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/look360-icon.svg" alt="" className="h-8 w-8" />
          <span className="text-sidebar-fg text-lg font-extrabold tracking-tight">
            Look<span className="text-accent-light">360</span>
          </span>
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-sidebar-muted hover:text-sidebar-fg -mr-2 inline-flex h-11 w-11 items-center justify-center lg:hidden"
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
          plan={plan}
        />
      </nav>

      {/* Bas compact : compte (→ Paramètres) + déconnexion. Tout le reste est
          dans la page Paramètres. */}
      <div className="border-sidebar-border border-t p-2">
        <Link
          href="/parametres"
          onClick={onClose}
          className="hover:bg-sidebar-hover-bg flex items-center gap-2.5 rounded-lg p-2 transition-colors"
          title="Mon compte · Paramètres"
        >
          <span className="bg-sidebar-hover-bg text-sidebar-fg grid h-9 w-9 shrink-0 place-items-center rounded-full">
            <CircleUser size={22} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-sidebar-fg block truncate text-sm font-medium">{displayName}</span>
            <span className="text-sidebar-muted block text-xs">{planLabel(plan)}</span>
          </span>
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="text-sidebar-muted hover:text-danger flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-sm transition-colors"
          >
            <LogOut size={15} />
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
  credits = 0,
  plan = "free",
}: {
  children: React.ReactNode;
  displayName: string;
  initials: string;
  role: string;
  pendingCount?: number;
  credits?: number;
  plan?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = role === "superadmin";

  return (
    <div className="bg-bg flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden h-full lg:flex">
        <Sidebar
          displayName={displayName}
          initials={initials}
          role={role}
          isAdmin={isAdmin}
          pendingCount={pendingCount}
          credits={credits}
          plan={plan}
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
              credits={credits}
              plan={plan}
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
            className="text-muted-foreground hover:text-fg -ml-2 inline-flex h-11 w-11 items-center justify-center"
            aria-label="Ouvrir le menu"
          >
            <Icon name="menu" size={22} />
          </button>
          <Brand compact />
          <CreditsBadge credits={credits} plan={plan} compact />
        </header>

        <main className="app-canvas flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          <div className="rise-in mx-auto max-w-[1400px]">{children}</div>
        </main>

        {/* Barre d'onglets basse (mobile) — feel appli native */}
        <MobileTabBar onMenu={() => setMobileOpen(true)} />
      </div>
    </div>
  );
}
