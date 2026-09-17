import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nom, role")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.nom ?? user.email ?? "Utilisateur";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Soumissions en attente (badge nav) — admin uniquement.
  let pendingCount = 0;
  if (profile?.role === "admin") {
    const { count } = await supabase
      .from("produits")
      .select("id", { count: "exact", head: true })
      .in("statut_revue", ["soumis", "en_analyse"]);
    pendingCount = count ?? 0;
  }

  return (
    <AppShell
      displayName={displayName}
      initials={initials}
      role={profile?.role ?? "—"}
      pendingCount={pendingCount}
    >
      {children}
    </AppShell>
  );
}
