import { NextResponse, after } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInstanceRow, optOutNumber, saveInstanceStatus } from "@/lib/notify";
import { normalizeStatus } from "@/lib/swats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook SWATS (connection.update, messages.upsert). Les webhooks ne sont PAS
 * signés : protection par
 *   1. URL secrète  /api/webhooks/swats/<SWATS_WEBHOOK_TOKEN>  (comparaison à temps constant),
 *   2. instanceId == instance Look360,
 *   3. idempotence (empreinte de l'événement déjà vue → ignoré).
 * Réponse 2xx immédiate ; traitement après la réponse (after()).
 */
function tokenOk(given: string): boolean {
  const expected = process.env.SWATS_WEBHOOK_TOKEN;
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Payload = {
  event?: string;
  type?: string;
  instanceId?: string;
  instance?: string | { id?: string };
  data?: Record<string, unknown>;
  [k: string]: unknown;
};

const str = (v: unknown) => (typeof v === "string" ? v : null);

/** Texte d'un message entrant (formats usuels des API WhatsApp non officielles). */
function messageText(d: Record<string, unknown>): string | null {
  const m = (d.message ?? d) as Record<string, unknown>;
  const ext = m.extendedTextMessage as { text?: string } | undefined;
  return str(m.conversation) ?? str(ext?.text) ?? str(m.text) ?? str(d.body) ?? str(d.text) ?? null;
}

/** Numéro de l'expéditeur (chiffres seuls) + « venant de moi ? ». */
function sender(d: Record<string, unknown>): { digits: string | null; fromMe: boolean } {
  const key = (d.key ?? {}) as { remoteJid?: string; fromMe?: boolean; participant?: string };
  const jid = key.remoteJid ?? str(d.from) ?? str(d.sender) ?? str(d.remoteJid) ?? "";
  if (jid.includes("@g.us")) return { digits: null, fromMe: true }; // groupe : ignoré
  const digits = jid.split("@")[0].replace(/\D/g, "");
  return { digits: /^[1-9]\d{7,14}$/.test(digits) ? digits : null, fromMe: Boolean(key.fromMe ?? d.fromMe) };
}

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!tokenOk(token)) return new NextResponse(null, { status: 404 });

  const raw = await request.text();
  if (raw.length > 256_000) return new NextResponse(null, { status: 413 });
  let body: Payload;
  try {
    body = JSON.parse(raw) as Payload;
  } catch {
    return NextResponse.json({ ok: true }); // rien d'exploitable
  }

  after(async () => {
    const admin = createAdminClient();
    const inst = await getInstanceRow(admin);
    const instId = str(body.instanceId) ?? (typeof body.instance === "string" ? body.instance : str(body.instance?.id));
    if (!inst || !instId || instId !== inst.id) return; // pas notre instance

    // Idempotence : un même événement n'est traité qu'une fois.
    const id = createHash("sha256").update(raw).digest("hex");
    const { error: dup } = await (admin as unknown as { from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> } })
      .from("swats_webhook_events")
      .insert({ id });
    if (dup) return;

    const event = (str(body.event) ?? str(body.type) ?? "").toLowerCase();
    const data = (body.data ?? body) as Record<string, unknown>;

    if (event.includes("connection")) {
      const status = normalizeStatus(str(data.status) ?? str(data.state) ?? str(data.connection));
      await saveInstanceStatus(admin, inst.id, status);
      return;
    }

    if (event.includes("messages")) {
      const list = Array.isArray(data.messages) ? (data.messages as Record<string, unknown>[]) : [data];
      for (const m of list) {
        const { digits, fromMe } = sender(m);
        const text = (messageText(m) ?? "").trim().toUpperCase();
        if (!digits || fromMe) continue;
        if (/^(STOP|ARRET|ARRÊT|UNSUBSCRIBE|DESABONNER|DÉSABONNER)\b/.test(text)) {
          const n = await optOutNumber(admin, digits);
          if (n > 0) console.log("[swats] désabonnement STOP :", n, "compte(s)");
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
