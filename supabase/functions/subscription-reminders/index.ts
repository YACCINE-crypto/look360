// ===========================================================================
// Edge Function : subscription-reminders   (verify_jwt = FALSE — protégée par
// un secret d'en-tête x-cron-secret = CRON_SECRET, appelée par un cron).
//
// Pour chaque abonnement payant :
//   • J-7 / J-3 / J0 avant current_period_end → email de relance (Resend).
//   • échéance dépassée sans paiement → expire_subscription (plan=free,
//     status=expired, crédits mensuels → 10 000 affichés ; les crédits de
//     PACKS restent). L'accès à l'app est conservé en gratuit — jamais bloqué.
//
// Anti-doublon : table billing_reminders (user_id, period_end, kind). Le canal
// WhatsApp est prévu mais désactivé (WHATSAPP_ENABLED=false) sans rien casser.
// ===========================================================================

import { json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { sendEmail } from "../_shared/email.ts";

const DAY = 86_400_000;

function siteUrl(): string {
  return (Deno.env.get("SITE_URL") ?? "https://look360.io").replace(/\/+$/, "");
}

function reminderHtml(kind: string, plan: string): string {
  const url = `${siteUrl()}/offres`;
  const when = kind === "j7"
    ? "dans 7 jours"
    : kind === "j3"
    ? "dans 3 jours"
    : "aujourd'hui";
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1a56db">Ton abonnement Look360 arrive à échéance ${when}</h2>
      <p>Ton offre <b>${plan}</b> se renouvelle bientôt. Pour continuer à profiter
      de tes crédits mensuels et de tes fonctionnalités, pense à renouveler.</p>
      <p><a href="${url}" style="display:inline-block;background:#1a56db;color:#fff;
      padding:12px 20px;border-radius:9999px;text-decoration:none;font-weight:600">
      Renouveler mon offre</a></p>
      <p style="color:#6b7280;font-size:13px">Si tu ne renouvelles pas, ton compte
      repasse simplement en Gratuit — tes crédits déjà achetés restent, aucun blocage.</p>
    </div>`;
}

function expiredHtml(): string {
  const url = `${siteUrl()}/offres`;
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1a56db">Ton abonnement Look360 est arrivé à échéance</h2>
      <p>Ton compte est repassé en <b>Gratuit</b>. Tes crédits de recharge déjà
      achetés restent disponibles, et tu gardes l'accès à l'app.</p>
      <p><a href="${url}" style="display:inline-block;background:#1a56db;color:#fff;
      padding:12px 20px;border-radius:9999px;text-decoration:none;font-weight:600">
      Repasser à une offre payante</a></p>
    </div>`;
}

/** Insère une relance ; renvoie true si NOUVELLE (donc à envoyer/appliquer). */
async function claim(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  periodEnd: string,
  kind: string,
): Promise<boolean> {
  const { error } = await admin
    .from("billing_reminders")
    .insert({ user_id: userId, period_end: periodEnd, kind, channel: "email" });
  if (!error) return true;
  // 23505 = doublon (déjà traité) → ne pas renvoyer.
  return false;
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "forbidden" }, 403);
  }

  const admin = adminClient();
  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, current_period_end")
    .neq("plan", "free")
    .not("current_period_end", "is", null);
  if (error) return json({ error: "db_error", detail: error.message }, 500);

  const now = Date.now();
  const summary = { reminded: 0, expired: 0, scanned: subs?.length ?? 0 };

  for (const s of subs ?? []) {
    const endStr = s.current_period_end as string;
    const endMs = Date.parse(endStr);
    if (!Number.isFinite(endMs)) continue;
    const msLeft = endMs - now;

    // Échéance dépassée → expiration (une seule fois par période).
    if (msLeft <= 0) {
      if (await claim(admin, s.user_id, endStr, "expired")) {
        await admin.rpc("expire_subscription", { p_user: s.user_id });
        const email = await emailOf(admin, s.user_id);
        if (email) await sendEmail({ to: email, subject: "Ton abonnement Look360 a expiré", html: expiredHtml() });
        summary.expired++;
      }
      continue;
    }

    // Relances J-7 / J-3 / J0.
    const daysCeil = Math.ceil(msLeft / DAY);
    const kind = daysCeil === 7 ? "j7" : daysCeil === 3 ? "j3" : daysCeil === 1 ? "j0" : null;
    if (!kind) continue;
    if (await claim(admin, s.user_id, endStr, kind)) {
      const email = await emailOf(admin, s.user_id);
      if (email) {
        await sendEmail({
          to: email,
          subject: "Ton abonnement Look360 arrive à échéance",
          html: reminderHtml(kind, s.plan as string),
        });
      }
      // TODO(phase WhatsApp) : sendWhatsApp(...) — désactivé pour l'instant.
      summary.reminded++;
    }
  }

  return json({ ok: true, ...summary });
});

async function emailOf(
  admin: ReturnType<typeof adminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}
