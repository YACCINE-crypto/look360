import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

/**
 * Garde SERVEUR du panneau superadmin. Accessible UNIQUEMENT si
 * profiles.role = 'superadmin' — sinon redirect. Le proxy protège déjà la
 * route (login requis) ; on vérifie le rôle en base, jamais côté UI seul.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nom, role, suspended")
    .eq("id", uid)
    .maybeSingle();

  // Un superadmin suspendu n'a plus accès au panneau (is_superadmin le refuse
  // aussi côté SQL depuis 0031).
  if (profile?.role !== "superadmin" || profile.suspended) redirect("/");

  const displayName =
    (profile?.nom as string | undefined) ??
    (claims?.claims?.email as string | undefined) ??
    "Superadmin";

  return <AdminShell displayName={displayName}>{children}</AdminShell>;
}
