// ===========================================================================
// Prestataire GeniusPay (implémente PaymentProvider).
//
// Règles validées (à reprendre telles quelles) :
//   • currency 'XOF' UNIQUEMENT (XAF est rejeté en 422).
//   • NE PAS envoyer payment_method 'pawapay'.
//   • customer.country transmis si connu.
//
// Secrets (jamais en dur — variables d'environnement des Edge Functions) :
//   GENIUSPAY_ENV=sandbox|live   GENIUSPAY_API_KEY   GENIUSPAY_API_SECRET
//   GENIUSPAY_WEBHOOK_SECRET     (optionnel) GENIUSPAY_API_BASE
//
// NB contrat HTTP : le mapping requête/réponse est centralisé ici (une seule
// place à ajuster si le sandbox renvoie des noms de champs différents). Le
// parsing de la réponse est tolérant (checkout_url / payment_url / data.link…).
// ===========================================================================

import {
  CreatePaymentInput,
  CreatePaymentResult,
  hmacSha256Hex,
  PaymentProvider,
  timingSafeEqual,
  WebhookVerification,
} from "./payments.ts";

function baseUrl(): string {
  const override = Deno.env.get("GENIUSPAY_API_BASE");
  if (override) return override.replace(/\/+$/, "");
  const env = (Deno.env.get("GENIUSPAY_ENV") ?? "sandbox").toLowerCase();
  return env === "live"
    ? "https://api.geniuspay.io/api/v1"
    : "https://sandbox.geniuspay.io/api/v1";
}

/** Cherche récursivement la 1re URL http(s) sous des clés de type checkout/lien. */
function extractCheckoutUrl(obj: unknown): string | null {
  const KEYS = [
    "checkout_url",
    "checkoutUrl",
    "payment_url",
    "paymentUrl",
    "authorization_url",
    "redirect_url",
    "redirectUrl",
    "url",
    "link",
  ];
  const seen = new Set<unknown>();
  const walk = (o: unknown): string | null => {
    if (!o || typeof o !== "object" || seen.has(o)) return null;
    seen.add(o);
    const rec = o as Record<string, unknown>;
    for (const k of KEYS) {
      const v = rec[k];
      if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
    }
    for (const v of Object.values(rec)) {
      const found = walk(v);
      if (found) return found;
    }
    return null;
  };
  return walk(obj);
}

function extractString(obj: unknown, keys: string[]): string | undefined {
  const seen = new Set<unknown>();
  const walk = (o: unknown): string | undefined => {
    if (!o || typeof o !== "object" || seen.has(o)) return undefined;
    seen.add(o);
    const rec = o as Record<string, unknown>;
    for (const k of keys) {
      const v = rec[k];
      if (typeof v === "string" && v) return v;
      if (typeof v === "number") return String(v);
    }
    for (const v of Object.values(rec)) {
      const found = walk(v);
      if (found) return found;
    }
    return undefined;
  };
  return walk(obj);
}

export class GeniusPayProvider implements PaymentProvider {
  readonly name = "geniuspay";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const apiKey = Deno.env.get("GENIUSPAY_API_KEY");
    const apiSecret = Deno.env.get("GENIUSPAY_API_SECRET");
    if (!apiKey || !apiSecret) throw new Error("geniuspay_keys_missing");

    // GeniusPay n'accepte que XOF.
    if (input.currency !== "XOF") throw new Error("currency_must_be_xof");

    // Corps de requête. NB : PAS de payment_method 'pawapay'. On laisse
    // GeniusPay proposer les méthodes disponibles ; country aide au routage.
    const body: Record<string, unknown> = {
      amount: input.amount,
      currency: "XOF",
      description: input.description,
      reference: input.reference,
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      metadata: input.metadata,
      customer: {
        id: input.customer.id,
        ...(input.customer.email ? { email: input.customer.email } : {}),
        ...(input.customer.name ? { name: input.customer.name } : {}),
        ...(input.customer.country
          ? { country: input.customer.country }
          : {}),
      },
    };

    const res = await fetch(`${baseUrl()}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiSecret}`,
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = extractString(raw, ["message", "error", "detail"]) ??
        `geniuspay_http_${res.status}`;
      throw new Error(`geniuspay_create_failed: ${msg}`);
    }

    const checkoutUrl = extractCheckoutUrl(raw);
    if (!checkoutUrl) throw new Error("geniuspay_no_checkout_url");
    const providerRef = extractString(raw, [
      "id",
      "transaction_id",
      "transactionId",
      "reference",
    ]) ?? input.reference;

    return { checkoutUrl, providerRef, raw };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookVerification> {
    const secret = Deno.env.get("GENIUSPAY_WEBHOOK_SECRET");
    if (!secret) {
      return { valid: false, event: "", reference: "", reason: "no_secret" };
    }

    // Signature HMAC-SHA256 du corps brut (plusieurs noms d'en-tête possibles).
    const provided =
      headers.get("x-geniuspay-signature") ??
      headers.get("x-webhook-signature") ??
      headers.get("x-signature") ??
      "";
    const expected = await hmacSha256Hex(secret, rawBody);
    const cleaned = provided.trim().replace(/^sha256=/i, "");
    if (!cleaned || !timingSafeEqual(cleaned.toLowerCase(), expected)) {
      return { valid: false, event: "", reference: "", reason: "bad_signature" };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, event: "", reference: "", reason: "bad_json" };
    }

    // Anti-rejeu : horodatage de l'événement dans une fenêtre de 5 min.
    const tsStr =
      extractString(payload, ["timestamp", "created_at", "createdAt", "event_time"]) ??
      headers.get("x-geniuspay-timestamp") ??
      "";
    if (tsStr) {
      const ts = Number.isFinite(Number(tsStr))
        ? Number(tsStr) * (String(tsStr).length <= 10 ? 1000 : 1) // sec ou ms
        : Date.parse(tsStr);
      if (Number.isFinite(ts) && Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
        return { valid: false, event: "", reference: "", reason: "stale" };
      }
    }

    const event =
      extractString(payload, ["event", "type", "status", "event_type"]) ?? "";
    const reference =
      extractString(payload, [
        "reference",
        "merchant_reference",
        "merchantReference",
        "metadata_reference",
      ]) ?? "";
    const transactionId = extractString(payload, [
      "transaction_id",
      "transactionId",
      "id",
    ]);

    return { valid: true, event, reference, transactionId };
  }
}

/** Un événement GeniusPay signifie-t-il « paiement réussi » ? */
export function isSuccessEvent(event: string): boolean {
  const e = event.toLowerCase();
  return (
    e.includes("success") ||
    e === "payment.completed" ||
    e === "completed" ||
    e === "successful" ||
    e === "paid"
  );
}
