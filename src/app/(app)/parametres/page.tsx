import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CircleUser,
  Mail,
  BadgeCheck,
  Gauge,
  Bell,
  Store,
  ShieldCheck,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { formatCredits, planLabel } from "@/lib/billing";
import { PageHeader } from "@/components/ui";
import { NotifBell } from "@/components/NotifBell";
import { ShareToggle } from "./ShareToggle";

export const dynamic = "force-dynamic";

/** Groupe de réglages : titre discret + carte à lignes séparées. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-muted-foreground px-1 text-xs font-semibold uppercase tracking-wide">
        {title}
      </h2>
      <div className="border-border bg-surface shadow-card divide-border divide-y overflow-hidden rounded-2xl border">
        {children}
      </div>
    </section>
  );
}

/** Intérieur commun d'une ligne : petite icône + libellé (+ sous-titre) + contenu à droite. */
function RowBody({
  icon: Icon,
  label,
  sub,
  children,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <span className="bg-secondary text-accent grid h-9 w-9 shrink-0 place-items-center rounded-lg">
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-fg text-sm font-semibold">{label}</p>
        {sub && <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{sub}</p>}
      </div>
      {children}
    </>
  );
}

/** Ligne cliquable (navigue) : valeur/état à droite + chevron. */
function LinkRow({
  icon,
  label,
  sub,
  href,
  value,
  badge = false,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  href: string;
  value?: string;
  badge?: boolean;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-secondary/40 flex min-h-[56px] items-center gap-3 px-4 py-3 transition-colors"
    >
      <RowBody icon={icon} label={label} sub={sub}>
        {value &&
          (badge ? (
            <span className="bg-secondary text-accent shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize">
              {value}
            </span>
          ) : (
            <span className="text-fg shrink-0 text-sm font-semibold tabular-nums">{value}</span>
          ))}
        <ChevronRight size={18} className="text-muted-foreground ml-1 shrink-0" />
      </RowBody>
    </Link>
  );
}

/** Ligne non navigable : contrôle/valeur à droite (toggle, bouton, texte). */
function ControlRow({
  icon,
  label,
  sub,
  children,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
      <RowBody icon={icon} label={label} sub={sub}>
        <div className="shrink-0">{children}</div>
      </RowBody>
    </div>
  );
}

export default async function ParametresPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) redirect("/login");
  const email = (claims?.claims?.email as string | undefined) ?? undefined;

  const [{ data: profile }, sub] = await Promise.all([
    supabase.from("profiles").select("nom, role, vitrine_share").eq("id", uid).maybeSingle(),
    getSubscription(uid),
  ]);
  const share = profile?.vitrine_share ?? true;
  const isAdmin = (profile?.role ?? "membre") === "superadmin";
  const displayName = profile?.nom ?? email ?? "Mon compte";
  const plan = sub?.plan ?? "free";
  const credits = sub?.credits_balance ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Paramètres" subtitle="Ton compte, ton offre et tes préférences." />

      <Group title="Compte">
        <ControlRow icon={CircleUser} label="Nom">
          <span className="text-fg max-w-[55%] truncate text-sm font-semibold">{displayName}</span>
        </ControlRow>
        {email && (
          <ControlRow icon={Mail} label="Email">
            <span className="text-muted-foreground max-w-[60%] truncate text-sm">{email}</span>
          </ControlRow>
        )}
      </Group>

      <Group title="Offre & crédits">
        <LinkRow icon={BadgeCheck} label="Offre actuelle" href="/offres" value={planLabel(plan)} badge />
        <LinkRow
          icon={Gauge}
          label="Crédits disponibles"
          sub="Recherches & analyses Spy"
          href="/offres"
          value={formatCredits(credits)}
        />
      </Group>

      <Group title="Notifications">
        <ControlRow
          icon={Bell}
          label="Alertes push"
          sub="Concurrents suivis · échéance d'offre"
        >
          <NotifBell />
        </ControlRow>
      </Group>

      <Group title="Partage">
        <ControlRow
          icon={Store}
          label="Vitrine communautaire"
          sub="Partage tes tests validés — 100 % anonymisés (catégorie, pays, closing, marge). Jamais ton nom ni ta boutique."
        >
          <ShareToggle initial={share} />
        </ControlRow>
      </Group>

      {isAdmin && (
        <Group title="Administration">
          <LinkRow
            icon={ShieldCheck}
            label="Panneau admin"
            sub="Cockpit, clients, revenus & activité"
            href="/admin"
          />
        </Group>
      )}
    </div>
  );
}
