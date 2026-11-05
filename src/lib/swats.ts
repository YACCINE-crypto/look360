import "server-only";

// ============================================================================
// Client SWATS (API WhatsApp NON officielle, connexion par QR code).
// Base : https://api.scalor.net/api/v1 — Authorization: Bearer sk_live_…
// Secrets SERVEUR uniquement (jamais NEXT_PUBLIC_, jamais journalisés) :
//   SWATS_API_KEY        clé d'API
//   SWATS_INSTANCE_ID    instance Look360 (sinon : celle enregistrée en base)
//   SWATS_ENABLED        "true" pour envoyer réellement (faux par défaut)
//   SWATS_WEBHOOK_TOKEN  segment secret de l'URL du webhook
//   SWATS_DAILY_LIMIT    plafond d'envois/jour du plan SWATS (défaut 500)
// ============================================================================

const BASE = "https://api.scalor.net/api/v1";

export function swatsConfigured(): boolean {
  return Boolean(process.env.SWATS_API_KEY);
}
/** Interrupteur général : tant qu'il est faux, AUCUN message n'est envoyé (alertes → e-mail + push). */
export function swatsEnabled(): boolean {
  return process.env.SWATS_ENABLED === "true" && swatsConfigured();
}
export function swatsDailyLimit(): number {
  const n = Number(process.env.SWATS_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 500;
}

export type SwatsResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T | null;
  /** Code d'erreur de l'API (ex. instance_not_connected, daily_limit_exceeded, api_key_expired). */
  code: string | null;
  message: string | null;
  retryAfterSec: number | null;
  remaining: number | null;
};

/** Erreurs à réessayer (jamais les 4xx sauf 429). */
export const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function call<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
): Promise<SwatsResult<T>> {
  const key = process.env.SWATS_API_KEY;
  if (!key) return { ok: false, status: 0, data: null, code: "not_configured", message: "SWATS_API_KEY manquante", retryAfterSec: null, remaining: null };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (e) {
    // Réseau / délai : traité comme une 503 (réessayable). Jamais la clé dans le message.
    return { ok: false, status: 503, data: null, code: "network_error", message: e instanceof Error ? e.name : "network", retryAfterSec: null, remaining: null };
  }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  const err = (json.error ?? null) as { code?: string; message?: string } | string | null;
  const code =
    (typeof err === "object" && err?.code) || (json.code as string | undefined) || (typeof err === "string" ? err : null) || null;
  const message =
    (typeof err === "object" && err?.message) || (json.message as string | undefined) || null;
  const ra = Number(res.headers.get("retry-after"));
  const rem = res.headers.get("x-ratelimit-remaining");
  return {
    ok: res.ok,
    status: res.status,
    data: ((json.data ?? json) as T) ?? null,
    code: res.ok ? null : code ?? `http_${res.status}`,
    message: res.ok ? null : (message ?? null),
    retryAfterSec: Number.isFinite(ra) && ra > 0 ? ra : null,
    remaining: rem != null && rem !== "" && Number.isFinite(Number(rem)) ? Number(rem) : null,
  };
}

const pick = (o: Record<string, unknown> | null, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
};

/** Statut normalisé d'une instance (l'API peut renvoyer open/close/connected…). */
export function normalizeStatus(raw: string | null): string {
  const s = (raw ?? "").toLowerCase();
  if (["connected", "open", "online", "ready"].includes(s)) return "connected";
  if (["qr", "qrcode", "scan_qr", "waiting_qr"].includes(s)) return "qr";
  if (["connecting", "starting", "initializing"].includes(s)) return "connecting";
  if (!s) return "unknown";
  return "disconnected";
}

export async function createInstance(name: string) {
  const r = await call("POST", "/instance/create", { name });
  return { ...r, id: pick(r.data, "id", "instanceId", "instance_id") };
}

/** QR code en data URL (préfixe ajouté si l'API renvoie du base64 brut). */
export async function getQrCode(id: string) {
  const r = await call("GET", `/instance/${encodeURIComponent(id)}/qrcode`);
  let qr = pick(r.data, "qrcode", "qrCode", "qr", "base64", "code");
  if (qr && !qr.startsWith("data:")) qr = `data:image/png;base64,${qr}`;
  return { ...r, qr };
}

export async function getInstance(id: string) {
  const r = await call("GET", `/instance/${encodeURIComponent(id)}`);
  return {
    ...r,
    /** État normalisé : connected | qr | connecting | disconnected | unknown. */
    state: normalizeStatus(pick(r.data, "status", "state", "connectionStatus")),
    phone: pick(r.data, "phone", "number", "phoneNumber", "owner"),
  };
}

export async function restartInstance(id: string) {
  return call("POST", `/instance/${encodeURIComponent(id)}/restart`);
}

export async function setWebhook(id: string, url: string) {
  return call("PUT", `/instance/${encodeURIComponent(id)}/webhook`, {
    url,
    events: ["connection.update", "messages.upsert"],
  });
}

/** Numéro au format attendu par SWATS : international SANS « + » ni espaces. */
export function toSwatsNumber(e164: string): string | null {
  const d = e164.replace(/[^\d]/g, "");
  return /^[1-9]\d{7,14}$/.test(d) ? d : null;
}

/** Envoi : texte seul OU image + légende (un seul type par requête). */
export async function sendMessage(
  instanceId: string,
  number: string,
  msg: { text: string } | { mediaUrl: string; caption: string; fileName: string },
) {
  return call("POST", "/message/send", { instanceId, number, ...msg });
}
