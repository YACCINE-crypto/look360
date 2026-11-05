import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { emptyStats, mirrorAd, mirrorAds, needsMirror, type MirroredAd, type MirrorStats } from "@/lib/mediaMirror";
import { isMetaMediaHost } from "@/lib/mediaHosts";
import { mediaStorageConfigured, storeFromUrl } from "@/lib/mediaStorage";
import type { Json } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Miroir Bunny des créas publicitaires : rattrapage des nouvelles pubs ET
 * backfill des anciennes (même traitement, idempotent). Parcourt toutes les
 * tables qui affichent des créas :
 *   spy_searches (cache Spy + Top Trend, 30 j) · competitor_ads (Surveillance)
 *   · winner_daily (Winner Agent) · feed_ads (vidéos brutes) · spy_saved_ads
 *   · produits (image produit).
 * Lien Meta encore valide → copie Bunny ; déjà expiré → « média manquant »
 * (placeholder propre, jamais de cadre blanc). Aucun re-scraping Apify.
 *
 * Vercel Cron (`Authorization: Bearer $CRON_SECRET`), manuel (`x-cron-secret`)
 * ou superadmin connecté (ouvrir l'URL dans le navigateur pour lancer le backfill).
 * `?only=<table>` limite à une table ; la réponse donne le nombre de lignes réparées.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

type Admin = ReturnType<typeof createAdminClient>;
type TableReport = { scanned: number; repaired: number; remaining: number };

const BUDGET_MS = 270_000;

const isMetaUrl = (u: string | null | undefined): u is string => {
  if (!u) return false;
  try {
    return isMetaMediaHost(new URL(u).hostname);
  } catch {
    return false;
  }
};

/** Tables à payload SpyAd unique (une pub par ligne). */
async function mirrorPayloadTable(
  admin: Admin,
  table: "competitor_ads" | "winner_daily" | "feed_ads",
  key: string,
  deadline: number,
  stats: MirrorStats,
): Promise<TableReport> {
  const rep: TableReport = { scanned: 0, repaired: 0, remaining: 0 };
  const db = admin as unknown as {
    from: (t: string) => {
      select: (c: string) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }> };
      update: (v: Record<string, unknown>) => { eq: (k: string, v: unknown) => Promise<{ error: unknown }> };
    };
  };
  const { data } = await db.from(table).select(`${key}, payload`).limit(2000);
  const todo = (data ?? []).filter((r) => needsMirror(r.payload as MirroredAd, true));
  rep.scanned = data?.length ?? 0;
  let i = 0;
  const worker = async () => {
    while (i < todo.length && Date.now() < deadline) {
      const row = todo[i++];
      const before = row.payload as MirroredAd;
      const after = await mirrorAd(before, stats, { videos: true });
      if (JSON.stringify(after) !== JSON.stringify(before)) {
        await db.from(table).update({ payload: after as unknown as Json }).eq(key, row[key]);
        rep.repaired++;
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  rep.remaining = Math.max(0, todo.length - i);
  return rep;
}

/** Cache Spy : un tableau de pubs par ligne (30 derniers jours, utilisés par Top Trend). */
async function mirrorSearches(admin: Admin, deadline: number, stats: MirrorStats): Promise<TableReport> {
  const rep: TableReport = { scanned: 0, repaired: 0, remaining: 0 };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await admin
    .from("spy_searches")
    .select("id, results")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  rep.scanned = data?.length ?? 0;
  const todo = (data ?? []).filter((r) => ((r.results as unknown as MirroredAd[]) ?? []).some((a) => needsMirror(a, true)));
  for (const row of todo) {
    const left = deadline - Date.now();
    if (left < 5_000) break;
    const ads = (row.results as unknown as MirroredAd[]) ?? [];
    const res = await mirrorAds(ads, { videos: true, budgetMs: left - 3_000, stats });
    if (JSON.stringify(res.ads) !== JSON.stringify(ads)) {
      await admin.from("spy_searches").update({ results: res.ads as unknown as Json }).eq("id", row.id);
      rep.repaired++;
    }
    if (!res.complete) break;
  }
  rep.remaining = todo.length - rep.repaired;
  return rep;
}

/** Pubs sauvegardées : colonnes dédiées (miniature). */
async function mirrorSaved(admin: Admin, deadline: number, stats: MirrorStats): Promise<TableReport> {
  const rep: TableReport = { scanned: 0, repaired: 0, remaining: 0 };
  const { data } = await admin
    .from("spy_saved_ads")
    .select("id, ad_archive_id, thumbnail_source_url, thumbnail_cdn_url")
    .is("thumbnail_cdn_url", null)
    .limit(500);
  rep.scanned = data?.length ?? 0;
  for (const row of data ?? []) {
    if (Date.now() > deadline || !isMetaUrl(row.thumbnail_source_url)) continue;
    const ad = { ad_archive_id: row.ad_archive_id ?? row.id, thumbnail_url: row.thumbnail_source_url, media_type: "image" } as MirroredAd;
    const out = await mirrorAd(ad, stats, { videos: false });
    if (out.thumbnail_url && out.thumbnail_url !== row.thumbnail_source_url) {
      await admin.from("spy_saved_ads").update({ thumbnail_cdn_url: out.thumbnail_url }).eq("id", row.id);
      rep.repaired++;
    }
  }
  return rep;
}

/** Image d'un produit (Mes produits) encore sur le CDN Meta. */
async function mirrorProduits(admin: Admin, deadline: number, stats: MirrorStats): Promise<TableReport> {
  const rep: TableReport = { scanned: 0, repaired: 0, remaining: 0 };
  const { data } = await admin.from("produits").select("id, image_url").like("image_url", "%fbcdn%").limit(500);
  rep.scanned = data?.length ?? 0;
  for (const row of data ?? []) {
    if (Date.now() > deadline || !isMetaUrl(row.image_url)) continue;
    try {
      const r = await storeFromUrl(row.image_url, "", { fixedKey: `produits/${row.id}.jpg` });
      await admin.from("produits").update({ image_url: r.cdnUrl }).eq("id", row.id);
      stats.thumbs++;
      rep.repaired++;
    } catch (e) {
      // Expiré : on retire le lien mort (placeholder propre à l'affichage).
      if (/source_fetch_(403|404|410)/.test(e instanceof Error ? e.message : "")) {
        await admin.from("produits").update({ image_url: null }).eq("id", row.id);
        stats.missing++;
        rep.repaired++;
      } else stats.failed++;
    }
  }
  return rep;
}

async function isSuperadmin(): Promise<boolean> {
  try {
    await requireSuperadmin();
    return true;
  } catch {
    return false;
  }
}

async function run(request: Request) {
  if (!authorized(request) && !(await isSuperadmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!mediaStorageConfigured()) return NextResponse.json({ ok: false, error: "media_storage_not_configured" }, { status: 500 });
  const only = new URL(request.url).searchParams.get("only");
  const admin = createAdminClient();
  const deadline = Date.now() + BUDGET_MS;
  const stats = emptyStats();
  const tables: Record<string, TableReport> = {};
  const want = (t: string) => !only || only === t;

  // Ordre : ce que les utilisateurs voient le plus, et ce qui expire le plus vite.
  if (want("spy_searches")) tables.spy_searches = await mirrorSearches(admin, deadline, stats);
  if (want("competitor_ads")) tables.competitor_ads = await mirrorPayloadTable(admin, "competitor_ads", "ad_archive_id", deadline, stats);
  if (want("winner_daily")) tables.winner_daily = await mirrorPayloadTable(admin, "winner_daily", "id", deadline, stats);
  if (want("feed_ads")) tables.feed_ads = await mirrorPayloadTable(admin, "feed_ads", "id", deadline, stats);
  if (want("spy_saved_ads")) tables.spy_saved_ads = await mirrorSaved(admin, deadline, stats);
  if (want("produits")) tables.produits = await mirrorProduits(admin, deadline, stats);

  const repaired = Object.values(tables).reduce((n, t) => n + t.repaired, 0);
  const remaining = Object.values(tables).reduce((n, t) => n + t.remaining, 0);
  console.log("[media-mirror]", JSON.stringify({ repaired, remaining, stats }));
  return NextResponse.json({ ok: true, repaired, remaining, stats, tables });
}

export async function POST(request: Request) {
  return run(request);
}
export async function GET(request: Request) {
  return run(request);
}
