import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase "admin" avec la clé service_role.
 * Contourne la RLS — À N'UTILISER QUE côté serveur (route handlers, cron),
 * jamais dans un Client Component. Ne pas exposer la clé au navigateur.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
