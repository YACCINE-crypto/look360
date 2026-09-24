// ===========================================================================
// Couche d'abstraction PAIEMENT (générique).
// But : brancher GeniusPay aujourd'hui, et pouvoir ajouter Flutterwave /
// Paystack demain sans toucher aux Edge Functions. Chaque prestataire
// implémente PaymentProvider ; les fonctions ne parlent qu'à cette interface.
// Aucun nom de prestataire n'est exposé côté client (les boutons disent
// « Payer / Choisir / Recharger »).
// ===========================================================================

export type Purpose = "subscription" | "credit_pack";

export interface CreatePaymentInput {
  amount: number; // FCFA (entier)
  currency: string; // 'XOF' uniquement (validé)
  description: string;
  reference: string; // notre référence marchande (clé d'idempotence)
  returnUrl: string; // page de retour utilisateur
  callbackUrl: string; // URL du webhook (serveur → serveur)
  purpose: Purpose;
  metadata: Record<string, unknown>;
  customer: { id: string; email?: string; name?: string; country?: string };
}

export interface CreatePaymentResult {
  checkoutUrl: string;
  providerRef: string; // référence côté prestataire (ou la nôtre si échoée)
  raw: unknown;
}

export interface WebhookVerification {
  valid: boolean;
  event: string; // ex. 'payment.success'
  reference: string; // notre référence marchande, ré-émise par le prestataire
  transactionId?: string;
  reason?: string; // si invalide
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification>;
}

/** HMAC-SHA256 (hex) via Web Crypto — utilisé par les prestataires. */
export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparaison à temps constant (anti timing-attack) sur des chaînes hex. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
