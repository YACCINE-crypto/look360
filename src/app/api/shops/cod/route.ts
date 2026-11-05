import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callShopCrawl } from "@/lib/shops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;
/** Boutiques jamais vues lues en arrière-plan par appel (politesse + coût). */
const CRAWL_UNKNOWN = 5;

/**
 * Filtre « Paiement à la livraison » du Spy : parmi les domaines des pubs,
 * lesquels sont des boutiques où une app COD a été détectée. Les domaines
 * jamais vus sont lus en arrière-plan (reconnus à la recherche suivante).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { domains?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* corps vide */
  }
  const domains = [
    ...new Set(
      (Array.isArray(body.domains) ? body.domains : [])
        .map((d) => String(d).toLowerCase().replace(/^www\./, "").trim())
        .filter((d) => DOMAIN_RE.test(d)),
    ),
  ].slice(0, 200);
  if (domains.length === 0) return NextResponse.json({ cod: [], known: [] });

  // Badge COD seulement (pas le catalogue) : lu côté serveur pour tous les plans.
  const { data: rows } = await createAdminClient().from("shops").select("domain, status, cod_apps").in("domain", domains);
  const known = (rows ?? []).map((r) => r.domain as string);
  const cod = (rows ?? []).filter((r) => Array.isArray(r.cod_apps) && r.cod_apps.length > 0).map((r) => r.domain as string);

  const seen = new Set(known);
  const unknown = domains.filter((d) => !seen.has(d)).slice(0, CRAWL_UNKNOWN);
  if (unknown.length) {
    after(() => Promise.all(unknown.map((domain) => callShopCrawl({ mode: "domain", domain }, 45_000))).then(() => undefined));
  }
  return NextResponse.json({ cod, known });
}
