// Envoi d'email transactionnel via Resend. Si RESEND_API_KEY n'est pas
// configurée, l'envoi est un no-op silencieux (ne casse jamais le flux).

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  const from = Deno.env.get("EMAIL_FROM") ?? "Look360 <no-reply@look360.io>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// -- Canal WhatsApp : branchement préparé mais DÉSACTIVÉ (phase ultérieure).
// Laisser à false tant que le fournisseur WhatsApp n'est pas configuré ; le
// laisser désactivé ne doit jamais casser les relances email.
export const WHATSAPP_ENABLED = false;
export async function sendWhatsApp(_to: string, _message: string): Promise<boolean> {
  if (!WHATSAPP_ENABLED) return false;
  // TODO(phase WhatsApp) : brancher le fournisseur (Meta Cloud API / autre).
  return false;
}
