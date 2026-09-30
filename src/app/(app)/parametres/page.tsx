import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleUser, Bell, Gauge, ShieldCheck, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { formatCredits, planLabel } from "@/lib/billing";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { NotifBell } from "@/components/NotifBell";
import { ShareToggle } from "./ShareToggle";

export const dynamic = "force-dynamic";

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
  const role = profile?.role ?? "membre";
  const isAdmin = role === "superadmin";
  const displayName = profile?.nom ?? email ?? "Mon compte";
  const plan = sub?.plan ?? "free";
  const credits = sub?.credits_balance ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Paramètres" subtitle="Ton compte, ton offre et tes préférences." />

      {/* Compte */}
      <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
        <div className="flex items-center gap-3">
          <span className="bg-secondary text-accent grid h-14 w-14 shrink-0 place-items-center rounded-full">
            <CircleUser size={30} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-fg truncate text-lg font-bold">{displayName}</p>
            {email && <p className="text-muted-foreground truncate text-sm">{email}</p>}
            <span className="bg-secondary text-accent mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize">
              Offre {planLabel(plan)}
            </span>
          </div>
        </div>
      </div>

      {/* Crédits / usage */}
      <Link
        href="/offres"
        className="border-border bg-surface shadow-card card-lift flex items-center gap-3 rounded-2xl border p-5"
      >
        <span className="bg-secondary text-accent grid h-10 w-10 shrink-0 place-items-center rounded-xl">
          <Gauge size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-fg font-semibold">Crédits & offre</p>
          <p className="text-muted-foreground text-sm">
            <span className="text-fg font-semibold tabular-nums">{formatCredits(credits)}</span>{" "}
            crédits · offre {planLabel(plan)}
          </p>
        </div>
        <span className="bg-accent text-accent-on inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold">
          Gérer <ChevronRight size={14} />
        </span>
      </Link>

      {/* Notifications */}
      <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
        <div className="flex items-start gap-3">
          <span className="bg-secondary text-accent grid h-10 w-10 shrink-0 place-items-center rounded-xl">
            <Bell size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-fg font-semibold">Notifications</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Sois alerté dès qu&apos;un concurrent suivi lance une nouvelle pub, ou
              quand ton offre arrive à échéance.
            </p>
            <div className="mt-2">
              <NotifBell />
            </div>
          </div>
        </div>
      </div>

      {/* Panneau admin (superadmin uniquement) */}
      {isAdmin && (
        <Link
          href="/admin"
          className="border-border bg-surface shadow-card card-lift flex items-center gap-3 rounded-2xl border p-5"
        >
          <span className="bg-secondary text-accent grid h-10 w-10 shrink-0 place-items-center rounded-xl">
            <ShieldCheck size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-fg font-semibold">Panneau admin</p>
            <p className="text-muted-foreground text-sm">Cockpit, clients, revenus & activité.</p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" />
        </Link>
      )}

      {/* Partage vitrine */}
      <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-secondary text-accent grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                <Icon name="store" size={16} />
              </span>
              <p className="text-fg font-semibold">Partager mes tests validés à la communauté</p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Quand tu valides un produit (≥ 10 commandes reçues), il peut apparaître
              dans la <b className="text-fg">vitrine communautaire</b> des offres Business
              — <b className="text-fg">100 % anonymisé</b> : seulement la catégorie, le
              pays, le taux de closing et la marge. Jamais ton nom, jamais le nom exact
              de ton produit, jamais un lien vers ta boutique. Tu peux désactiver ce
              partage à tout moment.
            </p>
          </div>
          <ShareToggle initial={share} />
        </div>
      </div>
    </div>
  );
}
