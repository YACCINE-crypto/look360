// ===========================================================================
// Prestataire GeniusPay (implémente PaymentProvider).
// Contrat EXACT repris de l'intégration validée en prod (projet OS-ECOMMERCE) :
//
// CRÉATION (POST) :
//   URL      : GENIUSPAY_API_URL (défaut https://geniuspay.ci/api/v1/merchant/payments)
//   En-têtes : X-API-Key, X-API-Secret, Content-Type, Accept
//   Corps    : { amount, currency:'XOF', description, metadata,
//                [mmo_provider], customer:{ country } }
//              → PAS de reference/callback_url/return_url (GeniusPay génère la
//                référence ; la return_url se configure dans le dashboard).
//              → currency 'XOF' UNIQUEMENT (XAF rejeté 422).
//              → PAS de payment_method 'pawapay' (débit direct). Pour les pays
//                100% mobile-money on passe mmo_provider (indice opérateur).
//   Réponse  : data.reference (ou data.id) + data.checkout_url (ou checkoutUrl),
//              success !== false, HTTP 200/201.
//
// WEBHOOK :
//   Signature = HMAC-SHA256( `${X-Webhook-Timestamp}.${rawBody}` , SECRET )
//   En-têtes  : X-Webhook-Signature (hex, préfixe sha256= toléré), X-Webhook-Timestamp
//   Anti-rejeu: |now - timestamp| ≤ 5 min.
//
// Secrets (env des Edge Functions) : GENIUSPAY_API_URL, GENIUSPAY_API_KEY,
//   GENIUSPAY_API_SECRET, GENIUSPAY_WEBHOOK_SECRET, GENIUSPAY_ENV (label).
// ===========================================================================

import {
  CreatePaymentInput,
  CreatePaymentResult,
  hmacSha256Hex,
  PaymentProvider,
  timingSafeEqual,
  WebhookVerification,
} from "./payments.ts";

const DEFAULT_URL = "https://geniuspay.ci/api/v1/merchant/payments";
const MAX_SKEW_MS = 5 * 60 * 1000;

// Indice d'opérateur pour les pays 100% mobile money (non-XOF). Les pays XOF
// (CI, SN, BJ…) n'en ont pas besoin : lien checkout standard.
const MMO_PROVIDER: Record<string, string> = {
  GA: "AIRTEL_GAB", CD: "AIRTEL_COD", CG: "AIRTEL_COG", CM: "ORANGE_CMR",
  KE: "MPESA_KEN", RW: "AIRTEL_RWA", UG: "AIRTEL_UGA", ZM: "MTN_MOMO_ZMB",
};

function tsToMs(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  const d = Date.parse(raw);
  return Number.isFinite(d) ? d : null;
}

function normalizeStatus(event: string, dataStatus: string): string {
  const e = event.toLowerCase();
  let status = (dataStatus ?? "").toLowerCase();
  if (e.includes("success") || e.includes("paid") || e.includes("completed")) status = "success";
  else if (e.includes("fail") || e.includes("error") || e.includes("declin")) status = "failed";
  else if (e.includes("cancel")) status = "cancelled";
  else if (e.includes("expir")) status = "expired";
  if (["completed", "complete", "paid", "successful", "success"].includes(status)) status = "success";
  if (!status) status = "pending";
  return status;
}

export class GeniusPayProvider implements PaymentProvider {
  readonly name = "geniuspay";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const url = Deno.env.get("GENIUSPAY_API_URL") ?? DEFAULT_URL;
    const key = Deno.env.get("GENIUSPAY_API_KEY");
    const secret = Deno.env.get("GENIUSPAY_API_SECRET");
    if (!key || !secret) throw new Error("geniuspay_not_configured");
    if (input.currency !== "XOF") throw new Error("currency_must_be_xof");

    const country = (input.customer.country ?? "").toUpperCase().slice(0, 2);
    const provider = MMO_PROVIDER[country];

    const body: Record<string, unknown> = {
      amount: input.amount,
      currency: "XOF",
      description: input.description || "Look360",
      metadata: input.metadata,
    };
    if (provider) {
      body.mmo_provider = provider;
      body.customer = { country };
    } else if (country) {
      body.customer = { country };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "X-API-Secret": secret,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const d = (parsed.data ?? {}) as Record<string, unknown>;
    const reference = (d.reference ?? d.id ?? null) as string | null;
    const checkoutUrl = (d.checkout_url ?? d.checkoutUrl ?? null) as string | null;
    const ok = (res.status === 200 || res.status === 201) &&
      parsed.success !== false && !!reference && !!checkoutUrl;

    if (!ok) {
      const err = parsed.error as { message?: string } | string | undefined;
      const msg = (typeof err === "object" ? err?.message : err) ??
        (parsed.message as string | undefined) ?? raw.slice(0, 200) ??
        "geniuspay_error";
      throw new Error(`geniuspay_http_${res.status}: ${msg}`);
    }

    return { checkoutUrl: checkoutUrl!, providerRef: String(reference), raw: parsed };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookVerification> {
    const secret = Deno.env.get("GENIUSPAY_WEBHOOK_SECRET");
    if (!secret) return { valid: false, event: "", status: "", reference: "", reason: "not_configured" };

    const sig = (headers.get("X-Webhook-Signature") ?? headers.get("x-webhook-signature") ?? "")
      .replace(/^sha256=/i, "").trim().toLowerCase();
    const ts = (headers.get("X-Webhook-Timestamp") ?? headers.get("x-webhook-timestamp") ?? "").trim();
    if (!sig || !ts) return { valid: false, event: "", status: "", reference: "", reason: "missing_signature" };

    const tsMs = tsToMs(ts);
    if (tsMs === null || Math.abs(Date.now() - tsMs) > MAX_SKEW_MS) {
      return { valid: false, event: "", status: "", reference: "", reason: "stale_timestamp" };
    }

    const expected = await hmacSha256Hex(secret, `${ts}.${rawBody}`);
    if (!timingSafeEqual(expected, sig)) {
      return { valid: false, event: "", status: "", reference: "", reason: "bad_signature" };
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, event: "", status: "", reference: "", reason: "bad_json" };
    }

    const event = String(payload.event ?? payload.type ?? "");
    const d = (payload.data ?? payload ?? {}) as Record<string, unknown>;
    const reference = String(d.reference ?? d.id ?? payload.reference ?? "");
    const status = normalizeStatus(event, String(d.status ?? ""));
    const transactionId = (d.id ?? d.transaction_id ?? undefined) as string | undefined;

    return { valid: true, event, status, reference, transactionId };
  }
}
