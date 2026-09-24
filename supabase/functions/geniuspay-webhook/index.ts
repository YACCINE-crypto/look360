// ===========================================================================
// Edge Function : geniuspay-webhook   (verify_jwt = FALSE — auth = HMAC)
// Reçoit les notifications du prestataire. Sécurité :
//   • Signature HMAC-SHA256 du corps brut (GENIUSPAY_WEBHOOK_SECRET).
//   • Anti-rejeu : horodatage < 5 min (dans verifyWebhook).
//   • Idempotent : apply_payment_success verrouille la ligne paiement et
//     ignore un rejeu de la même référence (retour 'duplicate').
// Sur payment.success → metadata.purpose décide de l'effet :
//   subscription → plan payé + période +30j + has_ever_paid + crédits mensuels
//   credit_pack  → crédits du pack ajoutés (n'expirent pas), plan inchangé.
// ===========================================================================

import { json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { getProvider } from "../_shared/provider.ts";
import { isSuccessEvent } from "../_shared/geniuspay.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  const provider = getProvider();
  const v = await provider.verifyWebhook(raw, req.headers);

  if (!v.valid) return json({ error: "invalid_webhook", reason: v.reason }, 401);
  if (!v.reference) return json({ error: "no_reference" }, 400);

  const admin = adminClient();

  // Échec de paiement → marque 'failed' (si encore en attente), puis ACK.
  if (!isSuccessEvent(v.event)) {
    const e = v.event.toLowerCase();
    if (e.includes("fail") || e.includes("cancel") || e.includes("declin")) {
      await admin
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("provider", "geniuspay")
        .eq("provider_ref", v.reference)
        .eq("status", "pending");
    }
    return json({ ok: true, ignored: v.event });
  }

  // Paiement réussi → application atomique + idempotente.
  const { data, error } = await admin.rpc("apply_payment_success", {
    p_provider: "geniuspay",
    p_ref: v.reference,
    p_txn: v.transactionId ?? null,
  });
  if (error) {
    // 500 → le prestataire réessaiera (l'idempotence protège contre le doublon).
    return json({ error: "apply_failed", detail: error.message }, 500);
  }
  return json({ ok: true, result: data });
});
