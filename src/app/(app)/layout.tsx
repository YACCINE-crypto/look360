import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
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

  const sub = await getSubscription(userId);

  return (
    <AppShell
      displayName={displayName}
      initials={initials}
      role={role}
      pendingCount={pendingCount}
      credits={sub?.credits_balance ?? 0}
      plan={sub?.plan ?? "free"}
    >
      <PlanProvider plan={sub?.plan ?? "free"}>{children}</PlanProvider>
    </AppShell>
  );
}
