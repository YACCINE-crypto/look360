import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAdDetail } from "@/lib/apify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Détail complet d'UNE pub, à la demande (à l'ouverture). C'est ici — et non
 * dans la liste — qu'on paie le scraping du détail, pour garder la recherche
 * rapide. GET /api/spy/ad?id=<ad_archive_id>&country=FR
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const id = (sp.get("id") ?? "").trim();
  const country = (sp.get("country") ?? "FR").trim().toUpperCase();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  try {
    const ad = await fetchAdDetail(id, country);
    if (!ad) return NextResponse.json({ error: "introuvable" }, { status: 404 });
    return NextResponse.json({ ad });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
