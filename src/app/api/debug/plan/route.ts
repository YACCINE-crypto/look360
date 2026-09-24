import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Diagnostic (à supprimer après) : montre ce que le SERVEUR voit pour l'utilisateur
// connecté. Ne renvoie AUCUN secret — seulement le rôle/projet décodés de la clé
// service_role (claims publics du JWT) pour repérer une clé mal configurée.
function decodeJwtClaim(jwt: string | undefined, claim: string): string | null {
  try {
    const payload = jwt?.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
    );
    return json?.[claim] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "not_logged_in" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan, status, monthly_credits, credits_balance")
    .eq("user_id", userId)
    .maybeSingle();

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return Response.json({
    connectedUserId: userId,
    connectedEmail: claims?.claims?.email ?? null,
    adminRead: {
      plan: data?.plan ?? null,
      balance: data?.credits_balance ?? null,
      rowFound: !!data,
      error: error?.message ?? null,
    },
    // Indices de config (pas de secret) :
    serviceKeyRole: decodeJwtClaim(svcKey, "role"), // DOIT être "service_role"
    serviceKeyProjectRef: decodeJwtClaim(svcKey, "ref"), // DOIT être rgmaisiggksjnkxdhytv
    supabaseUrlHost: url.replace(/^https?:\/\//, "").split("/")[0],
  });
}
