// ===========================================================================
// Prestataire SasPay (implémente PaymentProvider). Contrat = spécification
// officielle https://api.saspay.me/api/v1 (skill saspay-integration). Aucune
// route hors spécification n'est utilisée :
//   POST /checkout-sessions/                 créer un checkout hébergé
//   GET  /checkout-sessions/{id}/status/     statut d'une session
//   GET  /payments/{payment_id}/verify/      statut RÉEL d'un paiement
//   GET  /countries/  ·  GET /pricing/my-rates/   (self-test)
//
// Règles :
//   - Authorization: Bearer SASPAY_API_KEY, côté serveur uniquement.
//   - Montants en chaînes décimales ("7500.00") ; repli "7500" si l'API refuse.
//   - Livraison UNIQUEMENT sur verify → status "SUCCESS", une seule fois
//     (apply_payment_success verrouille la ligne et renvoie 'duplicate').
//   - Webhook : HMAC-SHA256 hex de `${X-Webhook-Timestamp}.${corps brut}` avec
//     SASPAY_WEBHOOK_SECRET, horodatage ≤ 300 s, comparaison à temps constant.
//   - Frais : fee_charge_mode = SASPAY_FEE_MODE (DEDUCTED par défaut | ADD_ON).
//
// Secrets (env Edge Functions) : SASPAY_API_KEY, SASPAY_WEBHOOK_SECRET,
//   SASPAY_FEE_MODE, SASPAY_TEST_AMOUNT (facultatif), SASPAY_API_URL (facultatif).
// ===========================================================================

import {
  CreatePaymentInput,
  CreatePaymentResult,
  hmacSha256Hex,
  PaymentProvider,
  timingSafeEqual,
  WebhookVerification,
} from "./payments.ts";
import type { adminClient } from "./supabase.ts";

type Admin = ReturnType<typeof adminClient>;

const DEFAULT_API = "https://api.saspay.me/api/v1";
const MAX_SKEW_S = 300;

export function saspayApi(): string {
  return (Deno.env.get("SASPAY_API_URL") ?? DEFAULT_API).replace(/\/+$/, "");
}

function apiKey(): string {
  const k = Deno.env.get("SASPAY_API_KEY");
  if (!k) throw new Error("saspay_not_configured");
  return k;
}

export function feeMode(): "DEDUCTED" | "ADD_ON" {
  return (Deno.env.get("SASPAY_FEE_MODE") ?? "DEDUCTED").toUpperCase() === "ADD_ON" ? "ADD_ON" : "DEDUCTED";
}

export type SaspayResponse = { status: number; body: Record<string, unknown> };

/** Appel authentifié. `idempotencyKey` sur toute route qui engage de l'argent. */
export async function saspayFetch(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string; auth?: boolean } = {},
): Promise<SaspayResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.auth !== false) headers.Authorization = `Bearer ${apiKey()}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${saspayApi()}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: res.status, body };
}

/** Message d'erreur lisible depuis l'enveloppe SasPay (sans secret). */
export function saspayError(r: SaspayResponse): string {
  const e = r.body.error as { message?: string; code?: string } | undefined;
  if (e?.code || e?.message) return `${r.status} ${e.code ?? ""} ${e.message ?? ""}`.trim();
  return `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`;
}

function dataOf(r: SaspayResponse): Record<string, unknown> {
  return (r.body.data ?? r.body) as Record<string, unknown>;
}

/**
 * Identifiant de transaction porté par une session. Format constaté en live :
 * `transaction_id` (+ `transaction_status`) ; `transaction` gardé en repli.
 */
function transactionIdOf(d: Record<string, unknown>): string | null {
  if (typeof d.transaction_id === "string" && d.transaction_id) return d.transaction_id;
  const t = d.transaction;
  if (typeof t === "string" && t) return t;
  if (t && typeof t === "object" && typeof (t as { id?: unknown }).id === "string") {
    return (t as { id: string }).id;
  }
  return null;
}

/** GET /checkout-sessions/{id}/status/ → statut brut + transaction éventuelle. */
export async function sessionStatus(
  sessionId: string,
): Promise<{ ok: boolean; status: string; transactionId: string | null; error?: string }> {
  const r = await saspayFetch(`/checkout-sessions/${encodeURIComponent(sessionId)}/status/`);
  if (r.status !== 200) return { ok: false, status: "", transactionId: null, error: saspayError(r) };
  const d = dataOf(r);
  return { ok: true, status: String(d.status ?? "").toUpperCase(), transactionId: transactionIdOf(d) };
}

/** GET /payments/{id}/verify/ → statut RÉEL (seul SUCCESS autorise la livraison). */
export async function verifyPayment(
  paymentId: string,
): Promise<{ ok: boolean; status: string; currency: string | null; checkoutSession: string | null; error?: string }> {
  const r = await saspayFetch(`/payments/${encodeURIComponent(paymentId)}/verify/`);
  if (r.status !== 200) return { ok: false, status: "", currency: null, checkoutSession: null, error: saspayError(r) };
  const d = dataOf(r);
  return {
    ok: true,
    status: String(d.status ?? "").toUpperCase(),
    currency: typeof d.currency === "string" ? d.currency : null,
    // Session de checkout d'origine (constaté en live) → notre provider_ref.
    checkoutSession: typeof d.checkout_session === "string" ? d.checkout_session : null,
  };
}

/**
 * Traitement direct d'une transaction (webhook) : verify → SUCCESS → session
 * d'origine → apply_payment_success sur NOTRE paiement (provider_ref = session).
 * Idempotent. Renvoie le résultat, ou null si la transaction n'est pas à nous.
 */
export async function applyTransaction(admin: Admin, transactionId: string): Promise<string | null> {
  const v = await verifyPayment(transactionId);
  if (!v.ok || v.status !== "SUCCESS" || !v.checkoutSession) return null;
  const { data: pay } = await admin
    .from("payments")
    .select("id")
    .eq("provider", "saspay")
    .eq("provider_ref", v.checkoutSession)
    .maybeSingle();
  if (!pay) return null;
  const { data, error } = await admin.rpc("apply_payment_success", {
    p_provider: "saspay",
    p_ref: v.checkoutSession,
    p_txn: transactionId,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export class SasPayProvider implements PaymentProvider {
  readonly name = "saspay";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (input.currency !== "XOF") throw new Error("currency_must_be_xof");
    if (!input.customer.email) throw new Error("customer_email_required");
    const intent = String(input.metadata.payment_intent ?? crypto.randomUUID());

    const base: Record<string, unknown> = {
      currency: "XOF",
      description: input.description || "Look360",
      customer_email: input.customer.email,
      customer_name: input.customer.name || input.customer.email.split("@")[0],
      fee_charge_mode: feeMode(),
      metadata: input.metadata,
    };
    if (input.returnUrl) base.return_url = input.returnUrl;
    if (input.customer.country) base.country = input.customer.country;

    // Montant en chaîne décimale ; XOF n'a pas de centimes : si l'API refuse
    // "7500.00", on réessaie "7500" (nouvelle clé : corps différent).
    const attempts = [`${input.amount}.00`, `${input.amount}`];
    let last: SaspayResponse | null = null;
    for (let i = 0; i < attempts.length; i++) {
      const r = await saspayFetch("/checkout-sessions/", {
        method: "POST",
        body: { ...base, amount: attempts[i] },
        idempotencyKey: `look360-${intent}-${i}`,
      });
      last = r;
      if (r.status === 200 || r.status === 201) {
        const d = dataOf(r);
        const id = typeof d.id === "string" || typeof d.id === "number" ? String(d.id) : "";
        const url = typeof d.checkout_url === "string" ? d.checkout_url : "";
        if (!id || !url) throw new Error(`saspay_bad_response: ${JSON.stringify(r.body).slice(0, 200)}`);
        return { checkoutUrl: url, providerRef: id, raw: { id, slug: d.slug ?? null, amount: attempts[i] } };
      }
      // Seule une erreur de validation sur le montant justifie l'autre format.
      const amountRejected = r.status === 400 && JSON.stringify(r.body).toLowerCase().includes("amount");
      if (!amountRejected) break;
    }
    throw new Error(`saspay_http_${last ? saspayError(last) : "no_response"}`);
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification> {
    const secret = Deno.env.get("SASPAY_WEBHOOK_SECRET");
    if (!secret) return { valid: false, event: "", status: "", reference: "", reason: "not_configured" };

    const sig = (headers.get("X-Webhook-Signature") ?? "").trim().toLowerCase();
    const ts = (headers.get("X-Webhook-Timestamp") ?? "").trim();
    if (!sig || !/^\d+$/.test(ts)) {
      return { valid: false, event: "", status: "", reference: "", reason: "missing_signature" };
    }
    if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_S) {
      return { valid: false, event: "", status: "", reference: "", reason: "stale_timestamp" };
    }
    // Signature sur le CORPS BRUT (jamais re-sérialisé).
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
    const event = String(payload.event ?? headers.get("X-Webhook-Event") ?? "");
    const d = (payload.data ?? {}) as Record<string, unknown>;
    const transactionId = typeof d.id === "string" || typeof d.id === "number" ? String(d.id) : undefined;
    const status = event === "transaction.success"
      ? "success"
      : event === "transaction.failed" || event === "transaction.cancelled"
      ? "failed"
      : "pending";
    // La référence (session) n'est pas garantie dans le webhook : le rapprochement
    // se fait par vérification des sessions en attente (reconcileSaspay).
    return { valid: true, event, status, reference: "", transactionId };
  }
}


/**
 * Rapproche les paiements SasPay EN ATTENTE : statut de la session → id de
 * transaction → verify. Livre via apply_payment_success UNIQUEMENT sur SUCCESS
 * (idempotent : un second passage renvoie 'duplicate'). Utilisé par le webhook
 * (déclencheur) et au retour du client (filet de sécurité).
 */
export async function reconcileSaspay(
  admin: Admin,
  opts: { userId?: string; limit?: number } = {},
): Promise<{ checked: number; applied: number; duplicate: number; pending: number; failed: number; errors: number }> {
  const out = { checked: 0, applied: 0, duplicate: 0, pending: 0, failed: 0, errors: 0 };
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  let q = admin
    .from("payments")
    .select("id, provider_ref, user_id")
    .eq("provider", "saspay")
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data: rows } = await q;

  for (const p of (rows ?? []) as { id: string; provider_ref: string }[]) {
    out.checked++;
    try {
      const s = await sessionStatus(p.provider_ref);
      if (!s.ok) {
        out.errors++;
        console.error("saspay session status KO", p.provider_ref, s.error);
        continue;
      }
      if (!s.transactionId) {
        if (["EXPIRED", "CANCELLED"].includes(s.status)) {
          await admin.from("payments").update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", p.id).eq("status", "pending");
          out.failed++;
        } else {
          out.pending++;
        }
        continue;
      }
      const v = await verifyPayment(s.transactionId);
      if (!v.ok) {
        out.errors++;
        console.error("saspay verify KO", s.transactionId, v.error);
        continue;
      }
      // Seul SUCCESS livre (le montant est fixé par NOTRE session, pas par le payeur).
      if (v.status !== "SUCCESS") {
        out.pending++;
        continue;
      }
      const { data, error } = await admin.rpc("apply_payment_success", {
        p_provider: "saspay",
        p_ref: p.provider_ref,
        p_txn: s.transactionId,
      });
      if (error) {
        out.errors++;
        console.error("apply_payment_success KO", p.provider_ref, error.message);
      } else if (data === "duplicate") out.duplicate++;
      else out.applied++;
    } catch (e) {
      out.errors++;
      console.error("reconcile error", p.provider_ref, e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}
