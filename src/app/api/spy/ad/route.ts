import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAdDetail } from "@/lib/apify";
import { getSubscription } from "@/lib/credits";
import { planLimits } from "@/lib/billing";
import { reserveUsage, releaseUsage, QuotaError } from "@/lib/usage";
import { accountSuspended } from "@/lib/accountGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Détail complet d'UNE pub, à la demande (à l'ouverture). C'est ici — et non
 * dans la liste — qu'on paie le scraping du détail, pour garder la recherche
 * rapide. GET /api/spy/ad?id=<ad_archive_id>&country=FR
 * Appel Apify payant : réservé aux offres avec recherches, 1 market_search_unit
 * réservée atomiquement avant l'appel (rendue si l'appel échoue).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const id = (sp.get("id") ?? "").trim();
  const country = (sp.get("country") ?? "FR").trim().toUpperCase();
  if (!/^\d{1,32}$/.test(id)) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (!/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: "pays invalide" }, { status: 400 });
  if (await accountSuspended(userId)) return NextResponse.json({ error: "compte suspendu" }, { status: 403 });

  const sub = await getSubscription(userId);
  if (planLimits(sub?.plan).monthlySearches <= 0) {
    return NextResponse.json({ error: "offre payante requise" }, { status: 402 });
  }
  try {
    await reserveUsage(userId, 0, 1);
  } catch (e) {
    if (e instanceof QuotaError) return NextResponse.json({ error: "quota", code: `quota_${e.kind}` }, { status: 402 });
    throw e;
  }

  try {
    const ad = await fetchAdDetail(id, country);
    if (!ad) return NextResponse.json({ error: "introuvable" }, { status: 404 });
    return NextResponse.json({ ad });
  } catch (e) {
    await releaseUsage(userId, 0, 1);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
