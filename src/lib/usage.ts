import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// Quotas v2 — comptage SERVEUR des searches + market_search_units (table
// `subscription_usage`, fonctions SECURITY DEFINER de 0030). Le client ne peut
// jamais modifier ses compteurs. Aucun crédit visible ici.
//   - reserveSearch : réservation ATOMIQUE (pire cas) AVANT l'appel Apify,
//                     puis releaseUsage rend ce qui n'a pas été scrappé (un hit
//                     de cache = 0 unit) ou tout en cas d'échec.
//   - consumeDownload / consumeWinnerRun : vérif + incrément atomiques.
// ============================================================================

export type QuotaKind = "searches" | "units" | "markets" | "downloads" | "winner_runs" | "media" | "email";

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

function quotaFrom(message: string): QuotaError | null {
  if (message.includes("email_unverified")) return new QuotaError("email");
  for (const k of ["searches", "units", "downloads", "winner_runs", "media"] as const) {
    if (message.includes(`quota_${k}`)) return new QuotaError(k);
  }
  return null;
}

/**
 * Réserve, AVANT les appels Apify, `markets` recherches (1 recherche = 1 mot-clé
 * × 1 pays = 1 appel Apify ; la même valeur alimente le plafond de coût caché).
 * Vérif + incrément dans la même transaction SQL (FOR UPDATE) : des requêtes
 * parallèles ne peuvent pas dépasser le quota. Le plan EFFECTIF est lu en base.
 * Lève QuotaError (email | searches | units). Rendre ensuite ce qui a été servi
 * par le cache avec releaseUsage(userId, n, n).
 */
export async function reserveSearch(userId: string, markets: number): Promise<void> {
  const m = Math.max(1, Math.round(markets));
  await reserveUsage(userId, m, m);
}

export type Quota = {
  plan: string;
  limit: number;
  used: number;
  remaining: number;
  period_end: string | null;
  email_verified: boolean;
  allowed: boolean;
  reason: "email_unverified" | "quota_atteint" | null;
};

/** État du quota de recherche (lecture seule, plan effectif). */
export async function getQuota(userId: string): Promise<Quota | null> {
  const { data, error } = await rpc("can_search", { p_user: userId });
  if (error) {
    console.error("can_search failed:", error.message, "user:", userId);
    return null;
  }
  return (data as Quota) ?? null;
}

const PLAN_LABEL: Record<string, string> = { free: "Gratuit", starter: "Starter", pro: "Pro", business: "Business" };

/**
 * Réponse d'erreur unique quand une recherche est refusée :
 *   { error: 'quota_atteint', plan, limite, message }  ou
 *   { error: 'email_non_verifie', plan, limite, message }
 * Jamais le mot « crédits ».
 */
export async function quotaRefusal(userId: string, kind: QuotaKind) {
  const q = await getQuota(userId);
  const plan = q?.plan ?? "free";
  const limite = q?.limit ?? 0;
  if (kind === "email") {
    return {
      error: "email_non_verifie" as const,
      plan,
      limite,
      message: "Confirme ton adresse e-mail pour lancer tes recherches (lien envoyé à l'inscription).",
    };
  }
  return {
    error: "quota_atteint" as const,
    plan,
    limite,
    message:
      plan === "business"
        ? `Tu as atteint tes ${limite} recherches ce mois. Elles se rechargent à ta date de renouvellement.`
        : `Tu as atteint tes ${limite} recherches ce mois (offre ${PLAN_LABEL[plan] ?? plan}). Passe à l'offre supérieure pour continuer.`,
  };
}

/** Réserve `searches` + `units` (atomique). Lève QuotaError si plafond. */
export async function reserveUsage(userId: string, searches: number, units: number): Promise<void> {
  const { error } = await rpc("reserve_usage", {
    p_user: userId,
    p_searches: Math.max(0, Math.round(searches)),
    p_units: Math.max(0, Math.round(units)),
  });
  if (error) throw quotaFrom(error.message) ?? new Error(error.message);
}

/** Rend une partie d'une réservation (units non scrappés, ou tout si échec). */
export async function releaseUsage(userId: string, searches: number, units: number): Promise<Usage | null> {
  const { data, error } = await rpc("release_usage", {
    p_user: userId,
    p_searches: Math.max(0, Math.round(searches)),
    p_units: Math.max(0, Math.round(units)),
  });
  if (error) {
    console.error("release_usage failed:", error.message, "user:", userId);
    return null;
  }
  return (data as Usage) ?? null;
}

/** Réserve `n` objets de stockage média (atomique). Lève QuotaError("media") si plafond. */
export async function reserveMedia(userId: string, n: number): Promise<void> {
  if (n <= 0) return;
  const { error } = await rpc("reserve_media", { p_user: userId, p_n: n });
  if (error) throw quotaFrom(error.message) ?? new Error(error.message);
}

/** Rend `n` objets de stockage (archivage échoué ou objet supprimé). */
export async function releaseMedia(userId: string, n: number): Promise<void> {
  if (n <= 0) return;
  const { error } = await rpc("release_media", { p_user: userId, p_n: n });
  if (error) console.error("release_media failed:", error.message, "user:", userId);
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
