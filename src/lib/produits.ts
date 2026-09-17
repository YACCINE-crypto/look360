import type { Database } from "@/lib/database.types";

export type Produit = Database["public"]["Tables"]["produits"]["Row"];
export type ProduitInsert = Database["public"]["Tables"]["produits"]["Insert"];

// --- Statuts produit (§3 du plan) ---
export const STATUTS = [
  "idee",
  "a_tester",
  "en_test",
  "valide",
  "production",
  "abandonne",
] as const;
export type Statut = (typeof STATUTS)[number];

export const STATUT_LABELS: Record<Statut, string> = {
  idee: "Idée",
  a_tester: "À tester",
  en_test: "En test",
  valide: "Validé",
  production: "Production",
  abandonne: "Abandonné",
};

// Classes Tailwind (tokens Banani) pour le chip de statut.
export const STATUT_BADGE: Record<Statut, string> = {
  idee: "bg-chip-idee text-chip-idee-fg",
  a_tester: "bg-chip-bleu text-chip-bleu-fg",
  en_test: "bg-chip-bleu text-chip-bleu-fg",
  valide: "bg-chip-valide text-chip-valide-fg",
  production: "bg-primary text-primary-foreground",
  abandonne: "bg-danger-bg text-danger",
};

// --- Marchés ciblés (§8 : FCFA partout) ---
export const MARCHES = [
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "GA", label: "Gabon" },
  { code: "SN", label: "Sénégal" },
  { code: "BF", label: "Burkina Faso" },
  { code: "ML", label: "Mali" },
  { code: "TG", label: "Togo" },
  { code: "BJ", label: "Bénin" },
  { code: "CM", label: "Cameroun" },
] as const;

export function marcheLabel(code: string | null): string {
  if (!code) return "—";
  return MARCHES.find((m) => m.code === code)?.label ?? code;
}

// --- Catégories produit (design "Nouveau produit") ---
export const CATEGORIES = [
  "Santé & Bien-être",
  "Beauté & Cheveux",
  "Tech & Accessoires",
  "Maison & Jardin",
  "Mode & Accessoires",
  "Bébé & Enfant",
  "Auto & Moto",
  "Sport & Plein air",
] as const;

// --- Émotions / angles (§3 : biblio d'angles) ---
export const EMOTIONS = [
  "peur",
  "desir",
  "statut",
  "economie",
  "confort",
  "curiosite",
] as const;

// --- Tri de la page Recherche ---
export const TRIS = {
  recent: "Plus récent",
  ancien: "Plus ancien",
  cout_asc: "Coût livré ↑",
  cout_desc: "Coût livré ↓",
} as const;
export type Tri = keyof typeof TRIS;

// --- Mode de transit ---
export const MODES_TRANSIT = [
  { code: "aerien", label: "Aérien (au kilo)" },
  { code: "maritime", label: "Maritime (au CBM)" },
] as const;
export type ModeTransit = (typeof MODES_TRANSIT)[number]["code"];

/** Frais de transit aérien par défaut (FCFA / kg). */
export const DEFAULT_FRAIS_TRANSIT_KILO = 12000;

/**
 * Coût livré estimé — identique à la colonne générée en base (aperçu live) :
 *   Aérien   : prix_fournisseur + poids_kg × frais_transit_kilo
 *   Maritime : prix_fournisseur + cbm × frais_transit_cbm
 */
export function coutLivreEstime(input: {
  mode: ModeTransit;
  prixFournisseur: number | null | undefined;
  poidsKg?: number | null;
  fraisTransitKilo?: number | null;
  cbm?: number | null;
  fraisTransitCbm?: number | null;
}): number {
  const prix = input.prixFournisseur ?? 0;
  if (input.mode === "maritime") {
    return prix + (input.cbm ?? 0) * (input.fraisTransitCbm ?? 0);
  }
  return prix + (input.poidsKg ?? 0) * (input.fraisTransitKilo ?? 0);
}

/** Formatage FCFA (pas de décimales). */
export function formatFCFA(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    value,
  ) + " FCFA";
}

/** Nombre de jours entre aujourd'hui et la date (négatif = passé), ou null. */
export function joursRestants(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateISO + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Badge d'échéance planning : true si la date est aujourd'hui ou dans <= 2 jours
 * (aligné sur la règle des notifs, §6).
 */
export function echeanceProche(dateISO: string | null): boolean {
  const j = joursRestants(dateISO);
  return j !== null && j <= 2;
}

/** Libellé court d'échéance : "Aujourd'hui", "Dans 3j", "Retard 2j". */
export function echeanceLabel(dateISO: string | null): string | null {
  const j = joursRestants(dateISO);
  if (j === null) return null;
  if (j === 0) return "Aujourd'hui";
  if (j < 0) return `Retard ${-j}j`;
  return `Dans ${j}j`;
}

/** Échéance planning la plus proche entre les deux dates du produit. */
export function prochaineEcheance(
  dateATravailler: string | null,
  dateTest: string | null,
): string | null {
  const dates = [dateATravailler, dateTest].filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort()[0];
}
