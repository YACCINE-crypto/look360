import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { RefClaim } from "@/components/referral/RefTracker";
import { REF_COOKIE } from "@/lib/referral";
import { createClient } from "@/lib/supabase/server";
import { getQuota } from "@/lib/usage";
import { BillingBanner, type BillingState } from "@/components/BillingBanner";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { planLabel } from "@/lib/billing";
import { AppShell } from "@/components/AppShell";
import { PlanProvider } from "@/components/PlanProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Identité via getClaims (JWT local, sans round-trip réseau quand possible).
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");
  const userId = claims.sub as string;

  // Profil + compteur de soumissions EN PARALLÈLE (une seule latence DB).
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("nom, role, suspended").eq("id", userId).maybeSingle(),
    supabase
      .from("produits")
      .select("id", { count: "exact", head: true })
      .in("statut_revue", ["soumis", "en_analyse"]),
  ]);

  // Compte suspendu par un superadmin → accès bloqué.
  if (profile?.suspended) redirect("/suspendu");

  const role = profile?.role ?? "—";
  const displayName =
    profile?.nom ?? (claims.email as string | undefined) ?? "Utilisateur";
  const initials = displayName.slice(0, 2).toUpperCase();
  const pendingCount = role === "superadmin" ? (count ?? 0) : 0;

  // Plan EFFECTIF + quota + état de facturation, lus en base (jamais le plan brut).
  const [quota, { data: billing }, onboarding] = await Promise.all([
    getQuota(userId),
    (supabase as unknown as { rpc: (f: string) => Promise<{ data: unknown }> }).rpc("my_billing_state"),
    // Requête séparée : si la colonne n'existe pas encore, rien d'autre ne casse.
    supabase
      .from("profiles")
      .select("onboarding_done_at" as "nom")
      .eq("id", userId)
      .maybeSingle()
      .then((r) => r as unknown as { data: { onboarding_done_at: string | null } | null; error: unknown }),
  ]);
  // 1re connexion : onboarding affiché tant qu'il n'a pas été terminé ou passé.
  const showOnboarding = !onboarding.error && onboarding.data != null && onboarding.data.onboarding_done_at === null;
  const plan = quota?.plan ?? "free";
  // Lien de parrainage cliqué avant l'inscription : rattachement (règles en base).
  const hasRefCookie = (await cookies()).has(REF_COOKIE);

  return (
    <AppShell
      displayName={displayName}
      initials={initials}
      role={role}
      pendingCount={pendingCount}
      searchesUsed={quota?.used ?? 0}
      searchesLimit={quota?.limit ?? 0}
      plan={plan}
    >
      {hasRefCookie && <RefClaim />}
      <BillingBanner state={(billing as BillingState | null) ?? null} />
      {showOnboarding && <OnboardingModal firstName={(profile?.nom ?? "").split(" ")[0]} planLabel={planLabel(plan)} />}
      <PlanProvider plan={plan}>{children}</PlanProvider>
    </AppShell>
  );
}
