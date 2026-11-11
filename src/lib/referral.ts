import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// ============================================================================
// Parrainage : cookie d'attribution SIGNÉ (dernier clic, 30 j). Le cookie porte
// le code et l'heure du clic ; la signature HMAC (clé serveur) empêche de
// fabriquer une fausse date de clic. Les règles (auto-parrainage, une seule
// attribution, compte créé après le clic, validité) sont vérifiées EN BASE
// (claim_referral).
// ============================================================================

export const REF_COOKIE = "l360_ref";
export const VISITOR_COOKIE = "l360_vid";
export const REF_MAX_AGE = 30 * 24 * 3600;
export const CODE_RE = /^[A-Z0-9]{6,12}$/;

function key(): string {
  return process.env.REFERRAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

const mac = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url").slice(0, 32);

export function signRef(code: string, clickedAt: number): string | null {
  if (!key()) return null;
  const payload = `${code}.${clickedAt}`;
  return `${payload}.${mac(payload)}`;
}

export function readRef(value: string | undefined): { code: string; clickedAt: Date } | null {
  if (!value || !key()) return null;
  const [code, ts, sig] = value.split(".");
  if (!code || !ts || !sig || !CODE_RE.test(code) || !/^\d{10,14}$/.test(ts)) return null;
  const want = Buffer.from(mac(`${code}.${ts}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return { code, clickedAt: new Date(Number(ts)) };
}
