"use server";

import { requireSuperadmin } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createInstance,
  getInstance,
  getQrCode,
  listInstances,
  restartInstance,
  sendMessage,
  setWebhook,
  swatsConfigured,
  swatsDailyLimit,
  swatsEnabled,
  toSwatsNumber,
} from "@/lib/swats";
import { dispatchWhatsApp, getInstanceRow, saveInstanceStatus } from "@/lib/notify";
import { normalizePhone } from "@/lib/onboarding/options";

// Actions du superadmin (écran /admin/whatsapp). Chaque action revérifie le
// rôle en base. Aucune valeur secrète n'est jamais renvoyée au navigateur.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://look360.io").replace(/\/+$/, "");

export type WaState = {
  configured: boolean;
  enabled: boolean;
  webhookReady: boolean;
  dailyLimit: number;
  instance: { id: string; status: string; phone: string | null; statusAt: string; lastError: string | null } | null;
  queued: number;
  sentToday: number;
  optins: number;
};

type Res<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const errText = (r: { status: number; code: string | null; message: string | null }) =>
  `${r.code ?? `HTTP ${r.status}`}${r.message ? ` — ${r.message}` : ""}`;

export async function waState(): Promise<WaState> {
  await requireSuperadmin();
  const admin = createAdminClient();
  const db = admin as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const row = await getInstanceRow(admin);
  const [{ count: queued }, { data: usage }, { count: optins }] = await Promise.all([
    db.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("whatsapp_status", "queued"),
    db.from("whatsapp_daily_usage").select("sent").eq("day", new Date().toISOString().slice(0, 10)).maybeSingle(),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("whatsapp_optin", true),
  ]);
  return {
    configured: swatsConfigured(),
    enabled: swatsEnabled(),
    webhookReady: (process.env.SWATS_WEBHOOK_TOKEN ?? "").length >= 24,
    dailyLimit: swatsDailyLimit(),
    instance: row ? { id: row.id, status: row.status, phone: row.phone, statusAt: row.status_at, lastError: row.last_error } : null,
    queued: queued ?? 0,
    sentToday: usage?.sent ?? 0,
    optins: optins ?? 0,
  };
}

export async function waCreate(): Promise<Res> {
  await requireSuperadmin();
  const admin = createAdminClient();
  if (await getInstanceRow(admin)) return { ok: false, error: "Une instance existe déjà. Utilise « Reconnecter »." };
  const r = await createInstance("look360-alerts");
  if (!r.ok || !r.id) return { ok: false, error: `Création refusée : ${errText(r)}` };
  await saveInstanceStatus(admin, r.id, "created", { name: "look360-alerts" });
  return { ok: true };
}

export async function waQr(): Promise<Res<string>> {
  await requireSuperadmin();
  const row = await getInstanceRow(createAdminClient());
  if (!row) return { ok: false, error: "Crée d'abord l'instance." };
  const r = await getQrCode(row.id);
  if (!r.ok || !r.qr) return { ok: false, error: `QR indisponible : ${errText(r)}` };
  return { ok: true, data: r.qr };
}

/**
 * Relie une instance EXISTANTE (créée dans le tableau de bord SWATS) : on vérifie
 * qu'elle répond avec notre clé, puis on l'enregistre. Ne crée JAMAIS d'instance
 * (plan SWATS gratuit = 1 instance). Remplace une éventuelle ancienne ligne.
 */
export async function waLink(rawId: string): Promise<Res<string>> {
  await requireSuperadmin();
  const typed = rawId.trim();
  if (typed && !/^[A-Za-z0-9_.-]{4,120}$/.test(typed)) return { ok: false, error: "ID invalide : colle l'ID (ou son début) tel qu'affiché dans SWATS." };

  // 1) ID complet ? 2) sinon : liste des instances du compte → celle dont l'ID
  // (ou le nom) commence par ce qui a été collé ; champ vide → l'unique instance.
  let id: string | null = null;
  let r = typed ? await getInstance(typed) : null;
  if (r?.ok) id = typed;
  else {
    const list = await listInstances();
    if (!list.ok) {
      return {
        ok: false,
        error: typed
          ? `SWATS ne trouve pas « ${typed} » et ne donne pas la liste des instances (${list.error ?? "inconnu"}). Copie l'ID complet depuis SWATS (bouton copier ou détail de l'instance).`
          : `Impossible de lister les instances SWATS (${list.error ?? "inconnu"}). Colle l'ID de l'instance.`,
      };
    }
    const t = typed.toLowerCase();
    const matches = t
      ? list.items.filter((i) => i.id.toLowerCase().startsWith(t) || (i.name ?? "").toLowerCase().startsWith(t))
      : list.items;
    if (matches.length === 0) return { ok: false, error: `Aucune instance ${t ? `qui commence par « ${typed} »` : "sur ce compte SWATS"} (${list.items.length} trouvée(s)).` };
    if (matches.length > 1) return { ok: false, error: `${matches.length} instances correspondent : colle un ID plus long (${matches.map((m) => m.id).join(", ")}).` };
    id = matches[0].id;
    r = await getInstance(id);
    if (!r.ok) return { ok: false, error: `Instance ${id} trouvée mais illisible : ${errText(r)}` };
  }

  const admin = createAdminClient();
  const db = admin as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  await db.from("whatsapp_instance").delete().neq("id", id);
  await saveInstanceStatus(admin, id, r.state, { name: "look360-alerts", phone: r.phone, last_error: null });
  return { ok: true, data: `${r.state} (ID ${id})` };
}

/** Statut en direct (appelé en boucle pendant le scan). */
export async function waRefresh(): Promise<Res<string>> {
  await requireSuperadmin();
  const admin = createAdminClient();
  const row = await getInstanceRow(admin);
  if (!row) return { ok: false, error: "Aucune instance." };
  const r = await getInstance(row.id);
  if (!r.ok) return { ok: false, error: `Statut indisponible : ${errText(r)}` };
  await saveInstanceStatus(admin, row.id, r.state, r.phone ? { phone: r.phone, last_error: null } : { last_error: null });
  return { ok: true, data: r.state };
}

export async function waRestart(): Promise<Res> {
  await requireSuperadmin();
  const admin = createAdminClient();
  const row = await getInstanceRow(admin);
  if (!row) return { ok: false, error: "Aucune instance." };
  const r = await restartInstance(row.id);
  if (!r.ok) return { ok: false, error: `Redémarrage refusé : ${errText(r)}` };
  await saveInstanceStatus(admin, row.id, "connecting");
  return { ok: true };
}

export async function waWebhook(): Promise<Res<string>> {
  await requireSuperadmin();
  const token = process.env.SWATS_WEBHOOK_TOKEN ?? "";
  if (token.length < 24) return { ok: false, error: "SWATS_WEBHOOK_TOKEN manquant (au moins 24 caractères aléatoires) dans Vercel." };
  const row = await getInstanceRow(createAdminClient());
  if (!row) return { ok: false, error: "Crée d'abord l'instance." };
  const r = await setWebhook(row.id, `${SITE}/api/webhooks/swats/${token}`);
  if (!r.ok) return { ok: false, error: `Webhook refusé : ${errText(r)}` };
  return { ok: true, data: `${SITE}/api/webhooks/swats/••••••` };
}

/** Message de test vers UN numéro (action explicite du superadmin, même si l'envoi général est coupé). */
export async function waTest(rawNumber: string): Promise<Res> {
  await requireSuperadmin();
  const admin = createAdminClient();
  const e164 = normalizePhone(rawNumber);
  const number = e164 ? toSwatsNumber(e164) : null;
  if (!number) return { ok: false, error: "Numéro invalide : écris-le avec l'indicatif, ex. +225 07 00 00 00 00." };
  const row = await getInstanceRow(admin);
  if (!row) return { ok: false, error: "Crée et connecte d'abord l'instance." };
  const live = await getInstance(row.id);
  if (live.ok) await saveInstanceStatus(admin, row.id, live.state);
  if (!live.ok || live.state !== "connected") return { ok: false, error: "L'instance n'est pas connectée : scanne le QR code d'abord." };
  const r = await sendMessage(row.id, number, {
    text: "✅ *Test Look360*\nLes alertes WhatsApp fonctionnent.\n\nRéponds STOP pour te désabonner.",
  });
  if (!r.ok) return { ok: false, error: `Envoi refusé : ${errText(r)}` };
  return { ok: true };
}

/** Lance un passage d'envoi tout de suite (sinon : passages planifiés). */
export async function waDispatch(): Promise<Res<string>> {
  await requireSuperadmin();
  const r = await dispatchWhatsApp({ budgetMs: 50_000 });
  return { ok: true, data: `${r.sent} envoyé(s), ${r.retried} reporté(s), ${r.fallback} en repli${r.stopped ? ` (arrêt : ${r.stopped})` : ""}` };
}
