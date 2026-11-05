import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Droits d'accès de l'utilisateur courant, lus EN BASE sur son plan EFFECTIF
 * (my_plan : un abonnement expiré, suspendu ou non payé vaut « free »).
 * Source unique des aperçus serveur : Feed, pages Produits/Boutiques, Top
 * Trend, enrichissement des boutiques. Le floutage de l'interface vient
 * par-dessus ; la limite elle-même est appliquée ici, côté serveur.
 */
export type TopTrendAccess = "locked" | "preview" | "full";
export type Enrichment = "none" | "basic" | "full";

export type Access = {
  userId: string | null;
  plan: string; // plan effectif
  paid: boolean;
  /** Nb de pubs du Feed renvoyées (null = tout). */
  feedLimit: number | null;
  /** Nb de lignes renvoyées sur Produits gagnants / Boutiques (null = tout). */
  pagesLimit: number | null;
  topTrend: TopTrendAccess;
  /** Nb d'éléments par type en aperçu Top Trend. */
  topTrendPreview: number;
  enrichment: Enrichment;
};

/** Repli si la base ne répond pas : expérience gratuite (jamais plus). */
const FREE: Omit<Access, "userId"> = {
  plan: "free",
  paid: false,
  feedLimit: 20,
  pagesLimit: 5,
  topTrend: "locked",
  topTrendPreview: 0,
  enrichment: "none",
};

/** Aperçu par défaut des pages (repère d'affichage ; la vraie valeur vient de plan_limits). */
export const FREE_PREVIEW = 5;

/** Nb de produits du catalogue d'une boutique en enrichissement « basique » (Starter). */
export const BASIC_CATALOG_PREVIEW = 12;

type LimitsRow = {
  feed_limit: number | null;
  pages_limit: number | null;
  top_trend_access: TopTrendAccess;
  top_trend_preview: number | null;
  enrichment: Enrichment;
};

export const currentAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) return { userId: null, ...FREE };

  const db = supabase as unknown as {
    rpc: (fn: string) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data: plan, error } = await db.rpc("my_plan");
  if (error || typeof plan !== "string") return { userId, ...FREE };

  const { data: row } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: LimitsRow | null }> } };
    };
  })
    .from("plan_limits")
    .select("feed_limit, pages_limit, top_trend_access, top_trend_preview, enrichment")
    .eq("plan", plan)
    .maybeSingle();
  if (!row) return { userId, ...FREE };

  return {
    userId,
    plan,
    paid: plan !== "free",
    feedLimit: row.feed_limit,
    pagesLimit: row.pages_limit,
    topTrend: row.top_trend_access,
    topTrendPreview: row.top_trend_preview ?? 0,
    enrichment: row.enrichment,
  };
});
