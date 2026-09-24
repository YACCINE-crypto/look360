// ===========================================================================
// Edge Function : geniuspay-webhook   (verify_jwt = FALSE — auth = HMAC)
// Sécurité (contrat prestataire) :
//   Signature = HMAC-SHA256( `${X-Webhook-Timestamp}.${rawBody}`, SECRET )
//   Anti-rejeu : timestamp < 5 min.  Idempotent : apply_payment_success verrouille
//   la ligne paiement (rejouer la même référence renvoie 'duplicate').
// Sur statut 'success' → metadata.purpose (via payments) décide de l'effet :
//   subscription → plan payé + période +30j + has_ever_paid + crédits mensuels
//   credit_pack  → crédits du pack ajoutés (n'expirent pas), plan inchangé.
// ===========================================================================

import { json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { getProvider } from "../_shared/provider.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ received: true });

  const raw = await req.text();
  const v = await getProvider().verifyWebhook(raw, req.headers);
  if (!v.valid) return json({ error: "invalid_webhook", reason: v.reason }, 401);
  if (!v.reference) return json({ received: true, ignored: "no_reference" });

  const admin = adminClient();

  if (v.status !== "success") {
    if (["failed", "cancelled", "expired"].includes(v.status)) {
      await admin
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("provider", "geniuspay")
        .eq("provider_ref", v.reference)
        .eq("status", "pending");
    }
    return json({ received: true, status: v.status });
  }

  // Paiement réussi → application atomique + idempotente.
  const { data, error } = await admin.rpc("apply_payment_success", {
    p_provider: "geniuspay",
    p_ref: v.reference,
    p_txn: v.transactionId ?? null,
  });
  if (error) {
    // Référence inconnue (ex. paiement non enregistré) → on ACK pour éviter des
    // rejeux infinis ; sinon 500 pour que le prestataire réessaie.
    if (error.message.includes("payment_not_found")) {
      console.error("webhook: payment_not_found for ref", v.reference);
      return json({ received: true, ignored: "payment_not_found" });
    }
    return json({ error: "apply_failed", detail: error.message }, 500);
  }
  return json({ received: true, result: data });
});
