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
  Gift,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { getUsage } from "@/lib/usage";
import { planLabel, planLimits } from "@/lib/billing";
import { PageHeader } from "@/components/ui";
import { NotifBell } from "@/components/NotifBell";
import { ShareToggle } from "./ShareToggle";
import { FeedPreferences, WhatsAppSettings } from "./WhatsAppSettings";
import { CopyLink } from "../parrainage/ReferralClient";
import { fcfa, referralLink, ruleText, type ReferralSettings } from "@/lib/referralFormat";

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

  const [{ data: profile }, sub, usage] = await Promise.all([
    supabase.from("profiles").select("nom, role, vitrine_share").eq("id", uid).maybeSingle(),
    getSubscription(uid),
    getUsage(uid),
  ]);
  // Colonnes onboarding/WhatsApp lues à part : si la migration 0041 n'est pas
  // encore appliquée, le reste de la page fonctionne normalement.
  const { data: prefs, error: prefsErr } = (await supabase
    .from("profiles")
    .select("pref_niches, pref_markets, whatsapp_number, whatsapp_optin" as "nom")
    .eq("id", uid)
    .maybeSingle()) as unknown as {
    data: { pref_niches: string[]; pref_markets: string[]; whatsapp_number: string | null; whatsapp_optin: boolean } | null;
    error: unknown;
  };
  // Parrainage (crée le code au besoin). Erreur → la section est simplement masquée.
  const { data: refData } = await (supabase as unknown as {
    rpc: (f: string) => PromiseLike<{ data: unknown }>;
  }).rpc("my_referral_dashboard");
  const referral = refData as { code: string; settings: ReferralSettings; balance: { available: number } } | null;
  const share = profile?.vitrine_share ?? true;
  const isAdmin = (profile?.role ?? "membre") === "superadmin";
  const displayName = profile?.nom ?? email ?? "Mon compte";
  const plan = sub?.plan ?? "free";
  const lim = planLimits(plan);
  const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

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

      <Group title="Offre & usage">
        <LinkRow icon={BadgeCheck} label="Offre actuelle" href="/offres" value={planLabel(plan)} badge />
        {lim.monthlySearches > 0 ? (
          <LinkRow
            icon={Gauge}
            label="Recherches ce mois"
            sub={`Jusqu'à ${lim.maxMarkets} marché${lim.maxMarkets > 1 ? "s" : ""} par recherche`}
            href="/offres"
            value={`${nf(usage?.searches_used ?? 0)} / ${nf(lim.monthlySearches)}`}
          />
        ) : (
          <LinkRow
            icon={Gauge}
            label="Lancer mes recherches"
            sub="Les recherches perso sont réservées aux offres payantes"
            href="/offres"
            value="Passer en Starter"
          />
        )}
      </Group>

      <Group title="Notifications">
        <ControlRow
          icon={Bell}
          label="Alertes push"
          sub="Concurrents suivis · échéance d'offre (sur cet appareil)"
        >
          <NotifBell />
        </ControlRow>
      </Group>

      {!prefsErr && prefs && (
        <>
          <Group title="WhatsApp">
            <WhatsAppSettings number={prefs.whatsapp_number} optin={prefs.whatsapp_optin} />
          </Group>
          <Group title="Mon feed">
            <FeedPreferences niches={prefs.pref_niches ?? []} markets={prefs.pref_markets ?? []} />
          </Group>
        </>
      )}

      {referral?.code && (
        <Group title="Parrainage">
          <ControlRow
            icon={Gift}
            label={referralLink(referral.code).replace(/^https?:\/\//, "")}
            sub={`Code ${referral.code} · ${ruleText(referral.settings)} · disponible : ${fcfa(referral.balance.available)}`}
          >
            <div className="flex items-center gap-2">
              <CopyLink link={referralLink(referral.code)} compact />
              <Link href="/parrainage" className="text-accent hidden text-sm font-semibold hover:underline sm:inline">
                Mes gains
              </Link>
            </div>
          </ControlRow>
        </Group>
      )}

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
