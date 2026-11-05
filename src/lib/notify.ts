import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "@/lib/email";
import { getWebPush, type PushPayload, type StoredSubscription } from "@/lib/webpush";
import {
  getInstance,
  RETRYABLE,
  sendMessage,
  swatsDailyLimit,
  swatsEnabled,
  toSwatsNumber,
} from "@/lib/swats";

// ============================================================================
// Alertes utilisateur (Winners + notifs transactionnelles).
//  1. notifyUser() enregistre l'alerte (clé unique user + événement → jamais 2×).
//  2. Si l'utilisateur est éligible WhatsApp (offre Pro/Business EFFECTIVE +
//     opt-in + numéro valide) ET que l'envoi est activé (SWATS_ENABLED) ET que
//     l'instance est connectée → mise en FILE d'attente WhatsApp.
//     Sinon → repli immédiat e-mail + notification push. Jamais de perte.
//  3. dispatchWhatsApp() (job planifié) vide la file par PETITS LOTS espacés :
//     contrôle de connexion avant envoi, quota quotidien, X-RateLimit-Remaining,
//     429 → Retry-After, 5xx → backoff exponentiel + jitter, 4xx → pas de retry.
//     Tout échec définitif bascule l'alerte sur le repli e-mail + push.
// ============================================================================

type Admin = ReturnType<typeof createAdminClient>;
type Db = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};
const db = (a: Admin) => a as unknown as Db;

export type AlertInput = {
  userId: string;
  /** Clé d'idempotence par utilisateur, ex. `winners:2026-11-06`. */
  eventKey: string;
  kind: "winners" | "subscription" | "payment" | "system";
  title: string;
  body: string;
  /** Image (URL Bunny uniquement). */
  imageUrl?: string | null;
  /** Lien interne, ex. /winners. */
  link?: string | null;
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://look360.io").replace(/\/+$/, "");
const STOP_LINE = "Réponds STOP pour te désabonner.";
const MAX_ATTEMPTS = 4;
/** Taille d'un lot d'envoi WhatsApp (un lot par passage planifié). */
const BATCH = 15;

// ---------------------------------------------------------------------------
// Instance : statut en cache (webhook connection.update), rafraîchi si ancien.
// ---------------------------------------------------------------------------
export type InstanceRow = { id: string; status: string; status_at: string; phone: string | null; last_error: string | null; last_admin_alert_at: string | null };

export async function getInstanceRow(admin: Admin = createAdminClient()): Promise<InstanceRow | null> {
  const envId = process.env.SWATS_INSTANCE_ID;
  const q = db(admin).from("whatsapp_instance").select("*");
  const { data } = await (envId ? q.eq("id", envId) : q.order("created_at", { ascending: false })).limit(1).maybeSingle();
  if (data) return data as InstanceRow;
  return envId ? { id: envId, status: "unknown", status_at: new Date(0).toISOString(), phone: null, last_error: null, last_admin_alert_at: null } : null;
}

export async function saveInstanceStatus(admin: Admin, id: string, status: string, extra: Record<string, unknown> = {}) {
  await db(admin)
    .from("whatsapp_instance")
    .upsert({ id, status, status_at: new Date().toISOString(), ...extra }, { onConflict: "id" });
}

/** true seulement si l'instance est CONNECTÉE (cache < 15 min, sinon vérifiée auprès de SWATS). */
export async function instanceConnected(admin: Admin): Promise<{ ok: boolean; id: string | null; reason?: string }> {
  const row = await getInstanceRow(admin);
  if (!row) return { ok: false, id: null, reason: "no_instance" };
  const fresh = Date.now() - Date.parse(row.status_at) < 15 * 60_000;
  if (fresh) return { ok: row.status === "connected", id: row.id, reason: row.status };
  const r = await getInstance(row.id);
  if (r.status === 403 || r.code === "api_key_expired" || r.code === "api_key_invalid") {
    await alertSuperadmin(admin, "Clé d'API SWATS refusée (expirée ou invalide). Les alertes passent par e-mail + push.");
    return { ok: false, id: row.id, reason: r.code ?? "api_key" };
  }
  if (!r.ok) return { ok: false, id: row.id, reason: r.code ?? "unreachable" };
  await saveInstanceStatus(admin, row.id, r.state, r.phone ? { phone: r.phone } : {});
  return { ok: r.state === "connected", id: row.id, reason: r.state };
}

// ---------------------------------------------------------------------------
// Alerte superadmin (au plus une toutes les 6 h) : e-mail + push.
// ---------------------------------------------------------------------------
export async function alertSuperadmin(admin: Admin, message: string) {
  const row = await getInstanceRow(admin);
  if (row?.last_admin_alert_at && Date.now() - Date.parse(row.last_admin_alert_at) < 6 * 3600_000) return;
  if (row) await db(admin).from("whatsapp_instance").update({ last_admin_alert_at: new Date().toISOString(), last_error: message }).eq("id", row.id);
  const { data: admins } = await db(admin).from("profiles").select("id").eq("role", "superadmin");
  for (const a of (admins ?? []) as { id: string }[]) {
    await fallback(admin, a.id, { title: "WhatsApp Look360 : action requise", body: message, link: "/admin/whatsapp" });
  }
  console.error("[swats] alerte superadmin :", message);
}

// ---------------------------------------------------------------------------
// Repli : e-mail + notification push (jamais de perte).
// ---------------------------------------------------------------------------
async function fallback(admin: Admin, userId: string, a: { title: string; body: string; link?: string | null; imageUrl?: string | null }) {
  let any = false;
  // Notification push (appareils abonnés).
  try {
    const { data: subs } = await db(admin).from("push_subscriptions").select("id, endpoint, keys").eq("user_id", userId);
    if (subs?.length) {
      const webpush = getWebPush();
      const payload: PushPayload = { title: a.title, body: a.body, url: a.link ?? "/", tag: a.title.slice(0, 40) };
      for (const s of subs as { id: string; endpoint: string; keys: unknown }[]) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys } as unknown as StoredSubscription as never, JSON.stringify(payload));
          any = true;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db(admin).from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
  } catch {
    /* push indisponible : l'e-mail prend le relais */
  }
  // E-mail.
  if (emailConfigured()) {
    try {
      const { data } = await admin.auth.admin.getUserById(userId);
      const to = data?.user?.email;
      if (to) {
        const url = `${SITE}${a.link ?? "/"}`;
        const img = a.imageUrl ? `<p><img src="${a.imageUrl}" alt="" width="320" style="max-width:100%;border-radius:12px"></p>` : "";
        const ok = await sendEmail({
          to,
          subject: a.title,
          text: `${a.body}\n\n${url}`,
          html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 8px">${esc(a.title)}</h2><p>${esc(a.body)}</p>${img}<p><a href="${url}" style="display:inline-block;background:#1a56db;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">Ouvrir Look360</a></p></div>`,
        });
        any = any || ok;
      }
    } catch {
      /* rien de plus à faire : l'alerte reste visible dans l'historique */
    }
  }
  return any;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

async function markFallback(admin: Admin, id: string, userId: string, a: AlertInput | { title: string; body: string; link?: string | null; image_url?: string | null }, reason: string, waStatus = "skipped") {
  const img = "imageUrl" in a ? a.imageUrl : (a as { image_url?: string | null }).image_url;
  await fallback(admin, userId, { title: a.title, body: a.body, link: a.link, imageUrl: img ?? null });
  await db(admin)
    .from("notification_deliveries")
    .update({ whatsapp_status: waStatus, fallback_at: new Date().toISOString(), fallback_reason: reason })
    .eq("id", id);
}

// ---------------------------------------------------------------------------
// Éligibilité WhatsApp : offre Pro/Business EFFECTIVE + opt-in + numéro valide.
// ---------------------------------------------------------------------------
async function whatsappTarget(admin: Admin, userId: string): Promise<{ number: string } | { reason: string }> {
  const { data: plan } = await db(admin).rpc("effective_plan", { p_user: userId });
  if (plan !== "pro" && plan !== "business") return { reason: "plan" };
  const { data: p } = await db(admin)
    .from("profiles")
    .select("whatsapp_number, whatsapp_optin")
    .eq("id", userId)
    .maybeSingle();
  if (!p?.whatsapp_optin) return { reason: "no_optin" };
  const number = p.whatsapp_number ? toSwatsNumber(p.whatsapp_number) : null;
  return number ? { number } : { reason: "no_number" };
}

/**
 * Enregistre une alerte et la route : file WhatsApp si possible, sinon repli
 * immédiat e-mail + push. Idempotent : une 2e alerte avec la même clé est ignorée.
 */
export async function notifyUser(a: AlertInput): Promise<"queued" | "fallback" | "duplicate"> {
  const admin = createAdminClient();
  const { data: row, error } = await db(admin)
    .from("notification_deliveries")
    .insert({ user_id: a.userId, event_key: a.eventKey, kind: a.kind, title: a.title, body: a.body, image_url: a.imageUrl ?? null, link: a.link ?? null })
    .select("id")
    .maybeSingle();
  if (error || !row) return "duplicate"; // clé déjà vue (unique) → jamais 2×

  let reason: string | null = null;
  if (!swatsEnabled()) reason = "whatsapp_disabled";
  else {
    const t = await whatsappTarget(admin, a.userId);
    if ("reason" in t) reason = t.reason;
    else {
      const inst = await instanceConnected(admin);
      if (!inst.ok) reason = `instance_${inst.reason ?? "down"}`;
    }
  }
  if (reason) {
    await markFallback(admin, row.id, a.userId, a, reason);
    return "fallback";
  }
  await db(admin).from("notification_deliveries").update({ whatsapp_status: "queued" }).eq("id", row.id);
  return "queued";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Backoff exponentiel + jitter (secondes) pour la n-ième tentative. */
const backoffSec = (attempt: number) => Math.min(3600, 60 * 2 ** attempt) * (0.7 + Math.random() * 0.6);

export function whatsappText(a: { title: string; body: string; link?: string | null }) {
  const url = `${SITE}${a.link ?? "/"}`;
  return `*${a.title}*\n${a.body}\n\n${url}\n\n${STOP_LINE}`;
}

/**
 * Vide la file WhatsApp par petit lot (appelé par le job planifié, plusieurs
 * fois par jour, espacé). Respecte connexion, quota, limites et erreurs.
 */
export async function dispatchWhatsApp(opts: { budgetMs?: number } = {}) {
  const admin = createAdminClient();
  const start = Date.now();
  const budget = opts.budgetMs ?? 200_000;
  const out = { sent: 0, retried: 0, fallback: 0, stopped: null as string | null };

  const { data: queue } = await db(admin)
    .from("notification_deliveries")
    .select("id, user_id, title, body, image_url, link, whatsapp_attempts")
    .eq("whatsapp_status", "queued")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH);
  const items = (queue ?? []) as { id: string; user_id: string; title: string; body: string; image_url: string | null; link: string | null; whatsapp_attempts: number }[];
  if (items.length === 0) return out;

  // Envoi désactivé entre-temps → tout passe en repli.
  if (!swatsEnabled()) {
    for (const it of items) {
      await markFallback(admin, it.id, it.user_id, it, "whatsapp_disabled");
      out.fallback++;
    }
    return { ...out, stopped: "disabled" };
  }
  // Contrôle de connexion AVANT tout envoi.
  const inst = await instanceConnected(admin);
  if (!inst.ok || !inst.id) {
    for (const it of items) {
      await markFallback(admin, it.id, it.user_id, it, `instance_${inst.reason ?? "down"}`);
      out.fallback++;
    }
    await alertSuperadmin(admin, `Instance WhatsApp non connectée (${inst.reason ?? "inconnu"}). Reconnecte-la depuis /admin/whatsapp.`);
    return { ...out, stopped: "instance" };
  }

  for (const it of items) {
    if (Date.now() - start > budget) break;
    // Re-vérifie l'éligibilité au moment de l'envoi (opt-out ou fin d'offre entre-temps).
    const t = await whatsappTarget(admin, it.user_id);
    if ("reason" in t) {
      await markFallback(admin, it.id, it.user_id, it, t.reason);
      out.fallback++;
      continue;
    }
    // Quota quotidien du plan SWATS.
    const { data: allowed } = await db(admin).rpc("whatsapp_count_send", { p_limit: swatsDailyLimit() });
    if (!allowed) {
      await markFallback(admin, it.id, it.user_id, it, "daily_limit");
      out.fallback++;
      out.stopped = "daily_limit";
      continue;
    }
    await db(admin).from("notification_deliveries").update({ whatsapp_status: "sending" }).eq("id", it.id);
    const text = whatsappText(it);
    const r = await sendMessage(
      inst.id,
      t.number,
      it.image_url ? { mediaUrl: it.image_url, caption: text, fileName: "look360-winner.jpg" } : { text },
    );

    if (r.ok) {
      await db(admin).from("notification_deliveries").update({ whatsapp_status: "sent", sent_at: new Date().toISOString(), whatsapp_error: null }).eq("id", it.id);
      out.sent++;
    } else if (r.code === "instance_not_connected") {
      await saveInstanceStatus(admin, inst.id, "disconnected");
      await markFallback(admin, it.id, it.user_id, it, "instance_not_connected");
      await alertSuperadmin(admin, "L'instance WhatsApp s'est déconnectée. Reconnecte-la depuis /admin/whatsapp.");
      out.fallback++;
      out.stopped = "instance";
      break;
    } else if (r.status === 403 || r.code === "api_key_expired" || r.code === "api_key_invalid") {
      await markFallback(admin, it.id, it.user_id, it, r.code ?? "forbidden");
      await alertSuperadmin(admin, "Clé d'API SWATS refusée (expirée ou invalide). Les alertes passent par e-mail + push.");
      out.fallback++;
      out.stopped = "api_key";
      break;
    } else if (r.code === "daily_limit_exceeded") {
      await markFallback(admin, it.id, it.user_id, it, "daily_limit_exceeded");
      out.fallback++;
      out.stopped = "daily_limit";
      break;
    } else if (RETRYABLE.has(r.status) && it.whatsapp_attempts + 1 < MAX_ATTEMPTS) {
      const wait = r.status === 429 && r.retryAfterSec ? r.retryAfterSec : backoffSec(it.whatsapp_attempts);
      await db(admin)
        .from("notification_deliveries")
        .update({
          whatsapp_status: "queued",
          whatsapp_attempts: it.whatsapp_attempts + 1,
          next_attempt_at: new Date(Date.now() + wait * 1000).toISOString(),
          whatsapp_error: r.code ?? `http_${r.status}`,
        })
        .eq("id", it.id);
      out.retried++;
      if (r.status === 429) {
        out.stopped = "rate_limited";
        break;
      }
    } else {
      // 4xx (jamais réessayé) ou trop de tentatives → repli.
      await db(admin).from("notification_deliveries").update({ whatsapp_error: r.code ?? `http_${r.status}` }).eq("id", it.id);
      await markFallback(admin, it.id, it.user_id, it, r.code ?? `http_${r.status}`, "failed");
      out.fallback++;
    }
    // Plus de crédit d'appels : on s'arrête, le prochain passage reprendra.
    if (r.remaining != null && r.remaining <= 1) {
      out.stopped = "rate_remaining";
      break;
    }
    // Espacement humain entre deux messages (3 à 8 s).
    await sleep(3000 + Math.random() * 5000);
  }
  return out;
}

/** Désabonnement (STOP reçu) : retire le consentement du numéro concerné. */
export async function optOutNumber(admin: Admin, digits: string): Promise<number> {
  const { data } = await db(admin)
    .from("profiles")
    .update({ whatsapp_optin: false, whatsapp_optin_at: null })
    .eq("whatsapp_number", `+${digits}`)
    .eq("whatsapp_optin", true)
    .select("id");
  return (data ?? []).length;
}
