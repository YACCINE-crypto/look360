import type { Database } from "@/lib/database.types";

export type Test = Database["public"]["Tables"]["tests"]["Row"];
export type TestInsert = Database["public"]["Tables"]["tests"]["Insert"];

export type TestInput = {
  prix_vente_prevu: number | null;
  commandes_recues: number | null;
  commandes_confirmees: number | null;
  depense_pub: number | null;
  cout_produit_estime: number | null;
  frais_livraison_prevu: number | null;
};

// --- Seuils taux de confirmation (§5) ---
export type ConfirmationTier = "faible" | "correct" | "normal" | "super";
const CONFIRMATION_META: Record<
  ConfirmationTier,
  { label: string; badge: string }
> = {
  faible: {
    label: "Faible — demande pas convaincante",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  correct: {
    label: "Correct — à surveiller",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  normal: {
    label: "Normal — bon closing",
    badge: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  super: {
    label: "Super top — les clients veulent payer",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
};

function confirmationTier(taux: number): ConfirmationTier {
  if (taux < 35) return "faible";
  if (taux < 45) return "correct";
  if (taux < 60) return "normal";
  return "super";
}

// --- Seuils marge / verdict rentabilité (§5) ---
export type VerdictTier =
  | "pas_rentable"
  | "marge_faible"
  | "moyen"
  | "rentable";
const VERDICT_META: Record<VerdictTier, { label: string; badge: string }> = {
  pas_rentable: {
    label: "Pas rentable",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  marge_faible: {
    label: "Marge trop faible",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  moyen: {
    label: "Moyen — à optimiser",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  rentable: {
    label: "Rentable",
    badge: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
};

export type TestResult = {
  tauxConfirmation: number | null;
  ca: number | null;
  beneficeProjete: number | null;
  cpaRecue: number | null;
  coutParConfirmee: number | null;
  margeUnite: number | null;
  margePct: number | null;
  roas: number | null;
  confirmation: { tier: ConfirmationTier; label: string; badge: string } | null;
  verdict: { tier: VerdictTier; label: string; badge: string } | null;
};

/**
 * Calculs exacts de rentabilité (§5 du plan).
 * Divisions par zéro => null (affiché "—" côté UI).
 */
export function computeTest(input: TestInput): TestResult {
  const prix = input.prix_vente_prevu ?? 0;
  const recues = input.commandes_recues ?? 0;
  const confirmees = input.commandes_confirmees ?? 0;
  const pub = input.depense_pub ?? 0;
  const coutProduit = input.cout_produit_estime ?? 0;
  const fraisLiv = input.frais_livraison_prevu ?? 0;

  const tauxConfirmation = recues > 0 ? (confirmees / recues) * 100 : null;
  const ca = prix * confirmees;
  const beneficeProjete =
    (prix - coutProduit - fraisLiv) * confirmees - pub;
  const cpaRecue = recues > 0 ? pub / recues : null;
  const coutParConfirmee = confirmees > 0 ? pub / confirmees : null;
  const margeUnite = confirmees > 0 ? beneficeProjete / confirmees : null;
  const margePct = ca > 0 ? (beneficeProjete / ca) * 100 : null;
  const roas = pub > 0 ? ca / pub : null;

  const confirmation =
    tauxConfirmation === null
      ? null
      : (() => {
          const tier = confirmationTier(tauxConfirmation);
          return { tier, ...CONFIRMATION_META[tier] };
        })();

  const verdict = computeVerdict(beneficeProjete, margePct);

  return {
    tauxConfirmation,
    ca,
    beneficeProjete,
    cpaRecue,
    coutParConfirmee,
    margeUnite,
    margePct,
    roas,
    confirmation,
    verdict,
  };
}

function computeVerdict(
  benefice: number,
  margePct: number | null,
): { tier: VerdictTier; label: string; badge: string } | null {
  let tier: VerdictTier;
  if (benefice <= 0) {
    tier = "pas_rentable";
  } else if (margePct === null) {
    // Bénéfice positif mais CA nul (cas dégénéré) : on ne tranche pas.
    return null;
  } else if (margePct >= 30) {
    tier = "rentable";
  } else if (margePct >= 15) {
    tier = "moyen";
  } else {
    tier = "marge_faible";
  }
  return { tier, ...VERDICT_META[tier] };
}

/** Verdict stocké en base (clé courte, pour filtrer plus tard). */
export function verdictTierFromInput(input: TestInput): VerdictTier | null {
  return computeTest(input).verdict?.tier ?? null;
}

/** Marge % calculée depuis une ligne de test (ou null). */
export function margePctFromTest(t: Test): number | null {
  return computeTest({
    prix_vente_prevu: t.prix_vente_prevu,
    commandes_recues: t.commandes_recues,
    commandes_confirmees: t.commandes_confirmees,
    depense_pub: t.depense_pub,
    cout_produit_estime: t.cout_produit_estime,
    frais_livraison_prevu: t.frais_livraison_prevu,
  }).margePct;
}

/**
 * Construit une map produit_id -> marge % du test le plus récent.
 * `tests` doit être trié du plus récent au plus ancien.
 */
export function margeParProduit(tests: Test[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of tests) {
    if (t.produit_id in map) continue; // on garde le plus récent
    const m = margePctFromTest(t);
    if (m !== null) map[t.produit_id] = m;
  }
  return map;
}

/** Classe de couleur signal pour un % de marge (vert/ambre/rouge). */
export function margeColorClass(margePct: number | null): string {
  if (margePct === null) return "text-muted-foreground";
  if (margePct >= 30) return "text-success";
  if (margePct >= 15) return "text-warning";
  return "text-danger";
}

export function verdictMeta(tier: string | null) {
  if (tier && tier in VERDICT_META) {
    return VERDICT_META[tier as VerdictTier];
  }
  return null;
}
