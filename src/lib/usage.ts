import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { planLimits } from "@/lib/billing";

// ============================================================================
// Quotas v2 — comptage SERVEUR des searches + market_search_units (table
// `subscription_usage`, fonctions SECURITY DEFINER de 0030). Le client ne peut
// jamais modifier ses compteurs. Aucun crédit visible ici.
//   - assertSearchAllowed : garde-fou AVANT l'appel Apify (pire cas).
//   - recordSearchUsage   : +1 search, +N units (N = marchés réellement scrappés,
//                           un hit de cache = 0 unit).
//   - consumeDownload / consumeWinnerRun : vérif + incrément atomiques.
// ============================================================================

export type QuotaKind = "searches" | "units" | "markets" | "downloads" | "winner_runs";

export class QuotaError extends Error {
  kind: QuotaKind;
  constructor(kind: QuotaKind) {
    super(`quota_${kind}`);
    this.name = "QuotaError";
    this.kind = kind;
  }
}

export type Usage = {
  period_start: string;
  period_end: string | null;
  searches_used: number;
  market_search_units_used: number;
  video_downloads_used: number;
  winner_agent_runs: number;
};

type RpcResult = { data: unknown; error: { message: string } | null };
// Les fonctions 0030 ne sont pas (encore) dans database.types → appel typé souple.
function rpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const admin = createAdminClient() as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<RpcResult>;
  };
  return admin.rpc(fn, args);
}

/** Usage de la période courante (créé si absent). Null en cas d'erreur admin. */
export async function getUsage(userId: string): Promise<Usage | null> {
  const { data, error } = await rpc("get_usage", { p_user: userId });
  if (error) {
    console.error("get_usage failed:", error.message, "user:", userId);
    return null;
  }
  return (data as Usage) ?? null;
}

/**
 * Garde-fou AVANT un appel Apify : la recherche sur `markets` marchés est-elle
 * permise pour ce plan ? Lève QuotaError (markets | searches | units) sinon.
 * Contrôle le PIRE cas (tous les marchés en cache-miss).
 */
export async function assertSearchAllowed(
  userId: string,
  plan: string,
  markets: number,
): Promise<void> {
  const lim = planLimits(plan);
  const m = Math.max(1, markets);
  if (m > lim.maxMarkets) throw new QuotaError("markets");
  const u = await getUsage(userId);
  const searchesUsed = u?.searches_used ?? 0;
  const unitsUsed = u?.market_search_units_used ?? 0;
  if (searchesUsed + 1 > lim.monthlySearches) throw new QuotaError("searches");
  if (unitsUsed + m > lim.monthlyUnits) throw new QuotaError("units");
}

/** Enregistre la conso d'une recherche : +1 search, +units (marchés scrappés). */
export async function recordSearchUsage(userId: string, units: number): Promise<Usage | null> {
  const { data, error } = await rpc("record_search_usage", {
    p_user: userId,
    p_units: Math.max(0, Math.round(units)),
  });
  if (error) {
    console.error("record_search_usage failed:", error.message, "user:", userId);
    return null;
  }
  return (data as Usage) ?? null;
}

/** Consomme 1 téléchargement vidéo (atomique). Lève QuotaError("downloads") si plafond. */
export async function consumeDownload(userId: string): Promise<void> {
  const { error } = await rpc("consume_download", { p_user: userId });
  if (error) {
    if (error.message.includes("quota_downloads")) throw new QuotaError("downloads");
    throw new Error(error.message);
  }
}

/** Consomme 1 exécution Winner Agent (atomique). Lève QuotaError("winner_runs") si plafond. */
export async function consumeWinnerRun(userId: string): Promise<void> {
  const { error } = await rpc("consume_winner_run", { p_user: userId });
  if (error) {
    if (error.message.includes("quota_winner_runs")) throw new QuotaError("winner_runs");
    throw new Error(error.message);
  }
}
