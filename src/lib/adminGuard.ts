import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export class AdminGuardError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "unauthenticated" : "forbidden");
  }
}

/**
 * Garde serveur du panneau admin (ceinture) : session vérifiée auprès de
 * Supabase Auth (getUser, pas seulement le JWT local), puis rôle superadmin
 * non suspendu. Renvoie le client À LA SESSION DE L'UTILISATEUR : les RPC
 * admin_* gardent ainsi auth.uid() et leur propre contrôle is_superadmin()
 * (bretelles). Jamais de service_role ici.
 */
export async function requireSuperadmin(): Promise<SupabaseClient> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (error || !uid) throw new AdminGuardError(401);
  const { data: p } = await supabase.from("profiles").select("role, suspended").eq("id", uid).maybeSingle();
  if (p?.role !== "superadmin" || p.suspended) throw new AdminGuardError(403);
  return supabase;
}
