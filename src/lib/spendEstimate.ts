// ============================================================================
// DÉPENSE ESTIMÉE d'une pub — ce n'est PAS une donnée Meta.
// Meta ne publie la dépense que pour les pubs politiques / sociales. Pour les
// pubs ciblant l'UE, on connaît la portée réelle (transparence DSA) : on en
// déduit une FOURCHETTE indicative.
//
//   impressions ≈ portée × fréquence      (fréquence 1,2 à 2,0)
//   dépense     ≈ impressions × CPM / 1000 (CPM bas / haut du pays, en €)
//
// Les CPM sont des repères de marché (Meta e-commerce, prospection) à
// réajuster au besoin ; ils servent à donner un ordre de grandeur, pas un
// montant. Toujours affiché avec la mention « estimée » et la méthode.
// ============================================================================

const FREQ_LOW = 1.2;
const FREQ_HIGH = 2.0;

/** CPM (€ / 1000 impressions) bas et haut, par pays. */
const CPM: Record<string, [number, number]> = {
  FR: [6, 12],
  BE: [6, 12],
  LU: [7, 14],
  DE: [7, 14],
  AT: [7, 13],
  NL: [7, 13],
  IE: [7, 14],
  DK: [8, 15],
  SE: [8, 15],
  FI: [8, 15],
  IT: [4, 9],
  ES: [4, 9],
  PT: [3, 7],
  GR: [2, 5],
  PL: [2, 5],
  CZ: [2, 5],
  SK: [2, 5],
  HU: [2, 5],
  RO: [1.5, 4],
  BG: [1.5, 4],
  HR: [2, 5],
  SI: [3, 6],
  EE: [3, 6],
  LV: [2, 5],
  LT: [2, 5],
  CY: [3, 7],
  MT: [3, 7],
};
const CPM_DEFAULT: [number, number] = [4, 10];

export type SpendEstimate = { low: number; high: number; currency: "EUR"; cpm: [number, number] };

/** Fourchette indicative, ou null sans portée réelle (hors UE). */
export function estimateSpend(reach: number | null | undefined, country: string | null | undefined): SpendEstimate | null {
  if (reach == null || !Number.isFinite(reach) || reach <= 0) return null;
  const cpm = CPM[(country ?? "").toUpperCase()] ?? CPM_DEFAULT;
  return {
    low: (reach * FREQ_LOW * cpm[0]) / 1000,
    high: (reach * FREQ_HIGH * cpm[1]) / 1000,
    currency: "EUR",
    cpm,
  };
}

function euros(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("fr-FR")} k€`;
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

/** « 9 k€ – 30 k€ » */
export function formatSpendRange(e: SpendEstimate): string {
  return `${euros(e.low)} – ${euros(e.high)}`;
}

export const SPEND_METHOD =
  "Estimation Look360, pas un chiffre Meta : portée UE réelle × fréquence (1,2 à 2) × coût pour 1 000 affichages du pays. Meta ne publie pas la dépense des pubs commerciales.";
