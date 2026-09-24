import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Statut d'un paiement (page de retour). L'utilisateur ne peut lire que SON
// paiement (filtré par user_id issu de la session vérifiée).
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref) return Response.json({ error: "no_ref" }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("payments")
    .select("status, purpose, plan, credits")
    .eq("provider_ref", ref)
    .eq("user_id", userId)
    .maybeSingle();

  return Response.json({
    status: (data?.status as string) ?? "unknown",
    purpose: (data?.purpose as string) ?? null,
  });
}
