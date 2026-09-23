import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchSpyWithCache, searchSpyManyCountries } from "@/lib/spyCache";
import type { SpyFilters, SpyMediaType, SpyPlatform, SpyStatut } from "@/lib/spy";

/** Extrait la liste de pays (multi-sélection) ; retombe sur `country` unique. */
function parseCountries(src: Record<string, unknown>): string[] {
  const raw = src.countries;
  let list: string[] = [];
  if (Array.isArray(raw)) list = raw.map((c) => String(c));
  else if (typeof raw === "string" && raw.trim())
    list = raw.split(",").map((c) => c.trim());
  if (list.length === 0 && src.country) list = [String(src.country)];
  return Array.from(
    new Set(list.map((c) => c.trim().toUpperCase()).filter(Boolean)),
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // l'actor met ~40-55s à répondre (run-sync)

function toInt(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function parseFilters(src: Record<string, unknown>): SpyFilters {
  const platform = String(src.platform ?? "") as SpyPlatform;
  const mediaType = String(src.mediaType ?? src.media_type ?? "all") as SpyMediaType;
  const statut = String(src.statut ?? "active") as SpyStatut;
  const tri = String(src.tri ?? "score") as SpyFilters["tri"];
  return {
    q: String(src.q ?? src.keyword ?? "").trim(),
    country: String(src.country ?? "FR").trim().toUpperCase(),
    pageId: String(src.pageId ?? src.page_id ?? "").trim() || undefined,
    platform: platform === "facebook" || platform === "instagram" ? platform : "",
    statut: statut === "all" ? "all" : "active",
    mediaType: mediaType === "image" || mediaType === "video" ? mediaType : "all",
    ancienneteMin: toInt(src.ancienneteMin ?? src.anciennete_min),
    reachMin: toInt(src.reachMin ?? src.reach_min),
    variantsMin: toInt(src.variantsMin ?? src.variants_min),
    tri: ["score", "reach", "anciennete", "variants"].includes(tri ?? "") ? tri : "score",
    limit: toInt(src.limit),
  };
}

async function handle(filters: SpyFilters, countries: string[]) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!filters.q && countries.length === 0 && !filters.pageId) {
    return NextResponse.json({ error: "mot-clé ou pays requis" }, { status: 400 });
  }
  try {
    // Un seul pays (ou recherche annonceur) → chemin simple ; sinon fan-out.
    const result =
      countries.length <= 1
        ? await searchSpyWithCache({ ...filters, country: countries[0] ?? filters.country }, userId)
        : await searchSpyManyCountries(filters, countries, userId);
    if (result.capped) {
      return NextResponse.json(
        { error: "Plafond de recherches Spy atteint pour aujourd'hui. Réessaie demain." },
        { status: 429 },
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* body vide accepté */
  }
  return handle(parseFilters(body), parseCountries(body));
}

// GET pratique pour un test manuel dans le navigateur (connecté à l'app) :
//   /api/spy/search?q=montre&country=FR&debug=1
export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  return handle(parseFilters(sp), parseCountries(sp));
}
