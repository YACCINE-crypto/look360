// ===========================================================================
// Edge Function : saspay-verify   (verify_jwt = true)
// Filet de sécurité au retour du client (/offres?pay=return) : rapproche SES
// paiements SasPay en attente (session → transaction → verify). Ne livre que
// sur SUCCESS, une seule fois (idempotent avec le webhook).
// ===========================================================================

import { json, preflight } from "../_shared/http.ts";
import { adminClient, userClientFrom } from "../_shared/supabase.ts";
import { reconcileSaspay } from "../_shared/saspay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { data: userData, error } = await userClientFrom(req).auth.getUser();
  const user = userData?.user;
  if (error || !user) return json({ error: "unauthorized" }, 401);

  const r = await reconcileSaspay(adminClient(), { userId: user.id, limit: 5 });
  return json({ ok: true, ...r });
});
