// ============================================================================
// Look360 — Offres, crédits et coûts d'actions (constantes pures, réutilisables
// client + serveur). Valeurs EXACTES du plan maître — ne rien inventer.
// Aucun nom de prestataire ici (on parle de "crédits" et "recharge").
// ============================================================================

export type Plan = "free" | "starter" | "pro" | "business";
export const PLAN_ORDER: Plan[] = ["free", "starter", "pro", "business"];

export type PlanConfig = {
  label: string;
  monthlyCredits: number;
  competitorSlots: number;
  winnerEnabled: boolean;
  winnerKeywords: number; // nb max de mots-clés
  winnerCountries: number; // nb max de pays
  whatsapp: boolean;
  priceNormal: number; // FCFA
  priceFirst: number | null; // tarif de bienvenue (1er mois), null = pas de tarif réduit
};

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    label: "Gratuit",
    monthlyCredits: 10000,
    competitorSlots: 0,
    winnerEnabled: false,
    winnerKeywords: 0,
    winnerCountries: 0,
    whatsapp: false,
    priceNormal: 0,
    priceFirst: null,
  },
  starter: {
    label: "Starter",
    monthlyCredits: 120000,
    competitorSlots: 1,
    winnerEnabled: false,
    winnerKeywords: 0,
    winnerCountries: 0,
    whatsapp: false,
    priceNormal: 7500,
    priceFirst: 5000,
  },
  pro: {
    label: "Pro",
    monthlyCredits: 300000,
    competitorSlots: 3,
    winnerEnabled: true,
    winnerKeywords: 2,
    winnerCountries: 1,
    whatsapp: true,
    priceNormal: 15000,
    priceFirst: 10000,
  },
  business: {
    label: "Business",
    monthlyCredits: 600000,
    competitorSlots: 10,
    winnerEnabled: true,
    winnerKeywords: 5,
    winnerCountries: 2,
    whatsapp: true,
    priceNormal: 25000,
    priceFirst: 17500,
  },
};

export function planConfig(plan: string | null | undefined): PlanConfig {
  return PLANS[(plan as Plan) in PLANS ? (plan as Plan) : "free"];
}
export function planLabel(plan: string | null | undefined): string {
  return planConfig(plan).label;
}

// --- Coûts d'actions (en crédits) ---
// Unité UNIQUE dans toute l'app (base, Edge Functions, affichage) : recherche
// = 1 000 crédits/pays, analyse = 2 000. Cohérent avec les crédits mensuels
// (Gratuit 10 000 · Starter 120 000 · Pro 300 000 · Business 600 000).
export const SEARCH_COST_PER_COUNTRY = 1000;
export const ANALYZE_COST = 2000;

/** Coût d'une recherche manuelle = 1 000 crédits × nb de pays. */
export function searchCost(nCountries: number): number {
  return SEARCH_COST_PER_COUNTRY * Math.max(1, nCountries);
}

// --- Packs de recharge (achat en plus, tout plan) ---
export const CREDIT_PACKS = [
  { credits: 50000, price: 3000 },
  { credits: 120000, price: 6000 },
  { credits: 300000, price: 13000 },
];

/** Formate des crédits pour l'affichage (même unité que la base). */
export function formatCredits(n: number | null | undefined): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0));
}
