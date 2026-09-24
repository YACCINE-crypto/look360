import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Statut d'un paiement (page de retour). GeniusPay redirige vers la return_url
// configurée dans son dashboard, qui ne porte pas toujours notre référence :
// on accepte donc un `ref` explicite, sinon on prend le paiement le plus récent
// de l'utilisateur. Filtré par user_id issu de la session vérifiée.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let query = admin
    .from("payments")
    .select("status, purpose, plan, credits, created_at")
    .eq("user_id", userId);
  query = ref
    ? query.eq("provider_ref", ref)
    : query.order("created_at", { ascending: false }).limit(1);

  const { data } = await query.maybeSingle();
  return Response.json({
    status: (data?.status as string) ?? "unknown",
    purpose: (data?.purpose as string) ?? null,
  });
}
