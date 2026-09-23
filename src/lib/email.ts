import "server-only";

// ============================================================================
// Emails transactionnels via Resend (reçus, crédits bas, digest…). Branchement
// PRÉPARÉ : actif dès que RESEND_API_KEY + EMAIL_FROM sont en env serveur.
// Sans clé → no-op (l'app ne casse pas). AUCUNE clé n'est stockée dans le code.
//
// NB : les emails d'AUTH (confirmation d'inscription, réinitialisation) sont
// envoyés par Supabase Auth. Pour les router via Resend, configurer le SMTP
// personnalisé dans Supabase (Auth → SMTP : host smtp.resend.com, user "resend",
// pass = RESEND_API_KEY, from = no-reply@look360.io).
// ============================================================================

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "Look360 <no-reply@look360.io>";

export function emailConfigured(): boolean {
  return Boolean(API_KEY);
}

export type SendEmail = { to: string; subject: string; html: string; text?: string };

/** Envoie un email. Retourne false (sans lever) si non configuré ou en échec. */
export async function sendEmail({ to, subject, html, text }: SendEmail): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
