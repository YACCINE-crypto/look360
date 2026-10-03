import { createClient } from "@/lib/supabase/server";
import { getCachedSearch, dailyCapReached, persistSearch } from "@/lib/spyCache";
import {
  startSpyRun,
  getRunStatus,
  isTerminal,
  fetchDatasetItems,
} from "@/lib/apify";
import { normalizeApifyItem, applySpyFilters } from "@/lib/spy";
import { getSubscription } from "@/lib/credits";
import { assertSearchAllowed, recordSearchUsage, QuotaError } from "@/lib/usage";
import { planLimits } from "@/lib/billing";
import type { SpyFilters, SpyMediaType, SpyPlatform, SpyStatut } from "@/lib/spy";

/** Message clair par type de quota (jamais le mot « crédits »). */
function quotaMessage(kind: QuotaError["kind"], plan: string): string {
  const lim = planLimits(plan);
  if (kind === "markets" || (kind === "searches" && lim.monthlySearches === 0)) {
    return "Les recherches personnelles sont réservées aux offres payantes. Passe en Starter pour lancer tes propres recherches.";
  }
  return "Tu as atteint ta limite de recherche ce mois-ci. Passe à une offre supérieure pour continuer.";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 50;
const POLL_MS = 1200;
const BUDGET_MS = 52_000;

function toInt(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function parseFilters(src: Record<string, unknown>): SpyFilters {
  const platform = String(src.platform ?? "") as SpyPlatform;
  const mediaType = String(src.mediaType ?? "all") as SpyMediaType;
  const statut = String(src.statut ?? "active") as SpyStatut;
  const tri = String(src.tri ?? "score") as SpyFilters["tri"];
  const country = Array.isArray(src.countries) && src.countries.length
    ? String(src.countries[0])
    : String(src.country ?? "FR");
  return {
    q: String(src.q ?? "").trim(),
    country: country.trim().toUpperCase(),
    pageId: String(src.pageId ?? "").trim() || undefined,
    platform: platform === "facebook" || platform === "instagram" ? platform : "",
    statut: statut === "all" ? "all" : "active",
    mediaType: mediaType === "image" || mediaType === "video" ? mediaType : "all",
    ancienneteMin: toInt(src.ancienneteMin),
    reachMin: toInt(src.reachMin),
    variantsMin: toInt(src.variantsMin),
    tri: ["score", "reach", "anciennete", "variants"].includes(tri ?? "") ? tri : "score",
    limit: toInt(src.limit) ?? 40,
  };
}

const enc = new TextEncoder();
const line = (obj: unknown) => enc.encode(JSON.stringify(obj) + "\n");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* ok */
  }
  const filters = parseFilters(body);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!filters.q && !filters.country && !filters.pageId) {
    return new Response(JSON.stringify({ error: "mot-clé ou pays requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const t0 = Date.now();
      const send = (o: unknown) => controller.enqueue(line(o));
      try {
        // 1) Cache → réponse instantanée.
        const cached = await getCachedSearch(filters);
        if (cached) {
          send({ type: "ads", ads: cached.ads });
          send({ type: "done", cached: true, total: cached.ads.length, took_ms: Date.now() - t0 });
          controller.close();
          return;
        }

        // 2) Plafond journalier.
        if (await dailyCapReached(userId)) {
          send({ type: "error", status: 429, message: "Plafond de recherches atteint pour aujourd'hui." });
          controller.close();
          return;
        }

        // 3) Quota v2 (recherche 1 marché). Cache-miss uniquement (on est ici).
        const sub = await getSubscription(userId);
        const plan = sub?.plan ?? "free";
        try {
          await assertSearchAllowed(userId, plan, 1);
        } catch (e) {
          if (e instanceof QuotaError) {
            send({ type: "error", status: 402, message: quotaMessage(e.kind, plan) });
            controller.close();
            return;
          }
          throw e;
        }

        // 4) Run asynchrone + lecture progressive du dataset.
        const runInfo = await startSpyRun(filters);
        const { runId, datasetId, url } = runInfo;
        const accumulator: ReturnType<typeof normalizeApifyItem>[] = [];
        let offset = 0;
        let streamed = 0;

        while (true) {
          const items = await fetchDatasetItems(datasetId, offset, BATCH);
          if (items.length > 0) {
            offset += items.length;
            const normalized = items.map((it) => normalizeApifyItem(it, filters.country));
            accumulator.push(...normalized);
            const passing = applySpyFilters(normalized, filters);
            if (passing.length > 0) {
              streamed += passing.length;
              send({ type: "ads", ads: passing });
            }
            send({ type: "progress", found: streamed });
          }

          const status = await getRunStatus(runId);
          const done = isTerminal(status);
          // Terminé et plus rien de neuf à lire → on sort.
          if (done && items.length === 0) break;
          if (Date.now() - t0 > BUDGET_MS) break;
          if (items.length === 0) await sleep(POLL_MS);
        }

        // 5) Cache (jeu complet non filtré, comme le chemin classique) + conso.
        //    On ne met PAS en cache un résultat vide (throttling Meta transitoire
        //    → sinon on servirait "0 pub" pendant 12 h). Résultat vide = on ne
        //    brûle PAS d'unit (recherche sans résultat ≠ faute de l'utilisateur),
        //    mais la recherche reste comptée (anti-abus, borné par le cap/jour).
        if (accumulator.length > 0) {
          await persistSearch(filters, userId, url, accumulator, accumulator.length);
          await recordSearchUsage(userId, 1);
        } else {
          await recordSearchUsage(userId, 0);
        }

        const total = applySpyFilters(accumulator, filters).length;
        send({ type: "done", cached: false, total, took_ms: Date.now() - t0 });
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        send({ type: "error", status: 502, message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}
