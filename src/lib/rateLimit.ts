import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Limitation des tentatives (audit sécurité 2026-11-04, contrôles 11/12).
 * Compteurs en base (table rate_limits, fonction rate_limit_hit, service_role
 * uniquement) : fiable entre instances serverless, contrairement à la mémoire.
 *
 * Les Server Actions passent par Vercel : on lit l'IP réelle du visiteur dans
 * x-forwarded-for (posé par Vercel), sinon Supabase ne verrait que l'IP de Vercel.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "unknown";
}

type Rule = { key: string; windowSec: number; max: number };

/**
 * true = autorisé. Toutes les règles sont comptées. En cas de panne de la base,
 * on laisse passer (Supabase Auth garde ses propres limites) plutôt que de
 * bloquer tous les clients.
 */
export async function allow(rules: Rule[]): Promise<boolean> {
  const admin = createAdminClient();
  const results = await Promise.all(
    rules.map((r) =>
      admin
        .rpc("rate_limit_hit", { p_key: r.key, p_window_seconds: r.windowSec, p_max: r.max })
        .then(({ data, error }) => (error ? true : data !== false)),
    ),
  );
  return results.every(Boolean);
}

export const norm = (email: string) => email.trim().toLowerCase();

/**
 * Cloudflare Turnstile (anti-robot), vérifié côté serveur. Inactif tant que
 * TURNSTILE_SECRET_KEY et NEXT_PUBLIC_TURNSTILE_SITE_KEY ne sont pas configurées (aucun blocage avant la mise en place).
 */
export async function turnstileOk(token: FormDataEntryValue | null, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Les deux clés vont ensemble : sans la clé publique, le widget n'est pas affiché.
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const d = (await r.json()) as { success?: boolean };
    return d.success === true;
  } catch {
    return false;
  }
}
