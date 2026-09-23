import { headers } from "next/headers";

/**
 * Origine absolue de la requête (pour les liens email de confirmation/reset).
 * Marche en preview Vercel comme en prod ; repli sur NEXT_PUBLIC_SITE_URL puis
 * le domaine de prod.
 */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://look360.io";
}
