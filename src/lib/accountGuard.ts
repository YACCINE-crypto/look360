import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Compte suspendu par un superadmin ? À vérifier dans toute route serveur qui
 * agit via le service_role ou un service payant (Apify, CDN) : la RLS (0031)
 * bloque déjà les accès directs aux tables, mais pas ces chemins-là.
 * En cas d'erreur de lecture, on refuse (fail-closed).
 */
export async function accountSuspended(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("suspended")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("accountSuspended read failed:", error.message, "user:", userId);
    return true;
  }
  return Boolean((data as { suspended?: boolean } | null)?.suspended);
}
