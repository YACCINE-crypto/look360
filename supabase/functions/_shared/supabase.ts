import { createClient } from "npm:@supabase/supabase-js@2";

// Client service_role (bypass RLS) — injecté automatiquement dans les Edge
// Functions Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Client "utilisateur" à partir du header Authorization (pour identifier
// l'appelant d'une fonction protégée par JWT).
export function userClientFrom(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    },
  );
}
