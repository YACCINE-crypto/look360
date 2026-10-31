import { createClient } from "@/lib/supabase/server";
import { accountSuspended } from "@/lib/accountGuard";
import { getCachedSearch, dailyCapReached, persistSearch } from "@/lib/spyCache";
import { startSpyRun, getRunStatus, isTerminal, fetchDatasetItems } from "@/lib/apify";
import { normalizeApifyItem, isEUCountry, type SpyAd, type SpyFilters } from "@/lib/spy";
import { getSubscription } from "@/lib/credits";
import { reserveSearch, releaseUsage, QuotaError } from "@/lib/usage";
import { planLimits } from "@/lib/billing";

// Analyse d'un annonceur = toutes ses pubs actives sur un marché.
// Avant : rendu serveur synchrone (run-sync Apify) limité à 60 s → les
// annonceurs UE (détail des pubs requis pour l'audience) dépassaient et la
// page plantait. Ici : run asynchrone, pubs envoyées au fur et à mesure,
// jusqu'à ~4 min 30. Résultat mis en cache 12 h (ré-ouverture gratuite).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH = 50;
const POLL_MS = 1500;
const BUDGET_MS = 270_000;

const enc = new TextEncoder();
const line = (o: unknown) => enc.encode(JSON.stringify(o) + "\n");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (o: unknown, status: number) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

/** Filtres d'analyse : mêmes clés de cache que l'ancienne page (réutilise le cache). */
function analyseFilters(pageId: string, country: string): SpyFilters {
  return {
    q: "",
    country,
    pageId,
    statut: "active",
    tri: "anciennete",
    limit: 100,
    // Détail des pubs seulement dans l'UE (audience publiée) : ailleurs il
    // n'apporte rien et triple le temps de collecte.
    details: isEUCountry(country),
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* ok */
  }
  const pageId = String(body.pageId ?? "").trim();
  const country = String(body.country ?? "FR").trim().toUpperCase();
  if (!/^\d{1,32}$/.test(pageId) || !/^[A-Z]{2}$/.test(country)) {
    return json({ error: "annonceur invalide" }, 400);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) return json({ error: "unauthorized" }, 401);
  if (await accountSuspended(userId)) return json({ error: "compte suspendu" }, 403);

  const filters = analyseFilters(pageId, country);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(line(o));
      const t0 = Date.now();
      let reserved = false;
      try {
        // 1) Déjà analysé récemment → instantané et gratuit.
        const cached = await getCachedSearch(filters);
        if (cached) {
          send({ type: "ads", ads: cached.ads });
          send({ type: "done", cached: true, total: cached.ads.length });
          controller.close();
          return;
        }

        if (await dailyCapReached(userId)) {
          send({ type: "error", status: 429, message: "Plafond d'analyses atteint pour aujourd'hui. Réessaie demain." });
          controller.close();
          return;
        }

        const sub = await getSubscription(userId);
        const plan = sub?.plan ?? "free";
        if (planLimits(plan).monthlySearches === 0) {
          send({ type: "error", status: 402, message: "L'analyse d'un annonceur est réservée aux offres payantes." });
          controller.close();
          return;
        }
        try {
          await reserveSearch(userId, plan, 1);
          reserved = true;
        } catch (e) {
          if (e instanceof QuotaError) {
            send({ type: "error", status: 402, message: "Tu as atteint ta limite de recherches ce mois-ci. Passe à une offre supérieure pour continuer." });
            controller.close();
            return;
          }
          throw e;
        }

        // 2) Run asynchrone + lecture progressive.
        const { runId, datasetId, url } = await startSpyRun(filters);
        const all: SpyAd[] = [];
        let offset = 0;
        let finished = false;
        while (true) {
          const items = await fetchDatasetItems(datasetId, offset, BATCH);
          if (items.length > 0) {
            offset += items.length;
            const ads = items.map((it) => normalizeApifyItem(it, country));
            all.push(...ads);
            send({ type: "ads", ads });
            send({ type: "progress", found: all.length });
          }
          const status = await getRunStatus(runId);
          if (isTerminal(status) && items.length === 0) {
            finished = true;
            break;
          }
          if (Date.now() - t0 > BUDGET_MS) break;
          if (items.length === 0) await sleep(POLL_MS);
        }

        // 3) Cache + quota. Rien trouvé → la recherche n'est pas facturée.
        if (all.length > 0) {
          // Résultat partiel (temps écoulé) : affiché mais pas mis en cache.
          if (finished) await persistSearch(filters, userId, url, all, all.length);
        } else if (reserved) {
          await releaseUsage(userId, 0, 1);
        }
        send({ type: "done", cached: false, total: all.length, partial: !finished });
      } catch (e) {
        if (reserved) await releaseUsage(userId, 1, 1).catch(() => {});
        console.error("[analyse/stream]", e instanceof Error ? e.message : e);
        send({ type: "error", status: 502, message: "Impossible de récupérer les pubs de cet annonceur pour le moment. Réessaie dans un instant." });
      } finally {
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
