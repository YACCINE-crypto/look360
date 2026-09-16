import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase pour les Client Components (navigateur).
 * Utilise la clé anon publique — jamais la service_role ici.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
