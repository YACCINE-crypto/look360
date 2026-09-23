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
    monthlyCredits: 100,
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
    monthlyCredits: 1200,
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
    monthlyCredits: 3000,
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
    monthlyCredits: 6000,
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
export const SEARCH_COST_PER_COUNTRY = 10;
export const ANALYZE_COST = 20;

/** Coût d'une recherche manuelle = 10 crédits × nb de pays. */
export function searchCost(nCountries: number): number {
  return SEARCH_COST_PER_COUNTRY * Math.max(1, nCountries);
}

// --- Packs de recharge (achat en plus, tout plan) ---
export const CREDIT_PACKS = [
  { credits: 500, price: 3000 },
  { credits: 1200, price: 6000 },
  { credits: 3000, price: 13000 },
];

export function formatCredits(n: number | null | undefined): string {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0);
}
