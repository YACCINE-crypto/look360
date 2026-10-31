// ===========================================================================
// Edge Function : saspay-webhook   (verify_jwt = FALSE — auth = signature HMAC)
// URL à déclarer dans le tableau de bord SasPay (section Webhooks) :
//   https://<projet>.supabase.co/functions/v1/saspay-webhook
//
// 1. Vérifie X-Webhook-Timestamp (≤ 300 s) puis X-Webhook-Signature =
//    HMAC-SHA256 hex de `${timestamp}.${corps brut}` (SASPAY_WEBHOOK_SECRET).
// 2. Répond 2xx tout de suite ; le traitement continue en tâche de fond.
// 3. Traitement idempotent : rapprochement des paiements en attente par
//    vérification (verify → SUCCESS) puis apply_payment_success, qui verrouille
//    la ligne et ne livre qu'une fois. Le webhook n'est qu'un déclencheur : la
//    vérité vient toujours de GET /payments/{id}/verify/.
// ===========================================================================

import { json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { applyTransaction, reconcileSaspay, SasPayProvider } from "../_shared/saspay.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ received: true });

  const raw = await req.text(); // corps BRUT, jamais re-sérialisé
  const v = await new SasPayProvider().verifyWebhook(raw, req.headers);
  if (!v.valid) return json({ error: "invalid_webhook", reason: v.reason }, 401);

  // Seuls les événements de transaction déclenchent un rapprochement.
  if (!v.event.startsWith("transaction.")) {
    return json({ received: true, event: v.event });
  }

  const admin = adminClient();
  const work = (async () => {
    // 1) Voie directe : la transaction reçue → verify → notre paiement.
    if (v.event === "transaction.success" && v.transactionId) {
      const direct = await applyTransaction(admin, v.transactionId);
      if (direct) return { direct };
    }
    // 2) Secours : rapprochement des paiements en attente.
    return await reconcileSaspay(admin, { limit: 30 });
  })()
    .then((r) => console.log("saspay webhook", v.event, v.transactionId ?? "", JSON.stringify(r)))
    .catch((e) => console.error("saspay webhook processing failed", e instanceof Error ? e.message : String(e)));

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
    return json({ received: true, event: v.event });
  }
  await work;
  return json({ received: true, event: v.event });
});
