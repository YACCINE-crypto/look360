import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { formatCredits } from "@/lib/billing";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * Onboarding (STEP 8) — écran de bienvenue après création du compte.
 * Le compte Gratuit est déjà activé en base (trigger handle_new_profile →
 * subscriptions plan=free + crédits mensuels). Mini-guide 2-3 étapes.
 */
export default async function BienvenuePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const [{ data: profile }, sub] = await Promise.all([
    supabase.from("profiles").select("nom").eq("id", userId).maybeSingle(),
    getSubscription(userId),
  ]);

  const prenom =
    (profile?.nom as string | undefined)?.split(" ")[0] ??
    (claims?.claims?.email as string | undefined)?.split("@")[0] ??
    "";
  const credits = sub?.credits_balance ?? 0;

  const steps = [
    {
      icon: "search" as const,
      title: "Lance ta première recherche",
      body: "Trouve des produits qui cartonnent déjà (Spy Facebook, Afrique + Europe). Filtre par pays et repère les vrais winners.",
      cta: "Ouvrir la recherche",
      href: "/spy",
    },
    {
      icon: "flask" as const,
      title: "Teste la rentabilité",
      body: "Envoie un produit en test, entre tes commandes reçues/confirmées, et obtiens ton taux de closing, ta marge nette et le verdict.",
      cta: "Découvrir le testing",
      href: "/testing",
    },
    {
      icon: "trophy" as const,
      title: "Passe payant quand tu gagnes",
      body: "Plus de volume, Winner Agent automatique, Winners sur WhatsApp… quand tu es prêt, choisis ton offre.",
      cta: "Voir les offres",
      href: "/offres",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* En-tête bienvenue */}
      <div className="border-primary/25 bg-gradient-to-br from-secondary/50 to-surface rounded-2xl border p-6 text-center sm:p-8">
        <span className="bg-primary text-primary-foreground mx-auto grid h-14 w-14 place-items-center rounded-2xl">
          <Icon name="check" size={28} strokeWidth={3} />
        </span>
        <h1 className="text-foreground mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Bienvenue{prenom ? `, ${prenom}` : ""} 🎉
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Ton compte <span className="text-foreground font-semibold">Gratuit</span>{" "}
          est activé — sans carte bancaire.
        </p>
        <span className="text-primary bg-secondary mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold">
          <Icon name="trending" size={14} /> {formatCredits(credits)} crédits offerts
        </span>
      </div>

      {/* Mini-guide */}
      <div className="space-y-3">
        {steps.map((s, i) => (
          <div
            key={i}
            className="border-border bg-surface shadow-card flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center"
          >
            <span className="bg-secondary text-primary relative grid h-11 w-11 shrink-0 place-items-center rounded-xl">
              <Icon name={s.icon} size={20} />
              <span className="border-surface bg-foreground text-background absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold">
                {i + 1}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground font-semibold">{s.title}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">{s.body}</p>
            </div>
            <Link
              href={s.href}
              className="bg-foreground text-background inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              {s.cta} <Icon name="chevronRight" size={15} />
            </Link>
          </div>
        ))}
      </div>

      {/* Accès direct */}
      <div className="text-center">
        <Link
          href="/spy"
          className="bg-primary text-primary-foreground inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-95"
        >
          C&apos;est parti <Icon name="chevronRight" size={16} />
        </Link>
      </div>
    </div>
  );
}
