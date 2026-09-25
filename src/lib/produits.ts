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

// --- Statut de revue (workflow soumission agent -> validation admin) ---
export const STATUTS_REVUE = ["soumis", "en_analyse", "approuve", "rejete"] as const;
export type StatutRevue = (typeof STATUTS_REVUE)[number];

export const STATUT_REVUE_LABELS: Record<StatutRevue, string> = {
  soumis: "Soumis",
  en_analyse: "En analyse",
  approuve: "Approuvé",
  rejete: "Rejeté",
};

export const STATUT_REVUE_BADGE: Record<StatutRevue, string> = {
  soumis: "bg-chip-bleu text-chip-bleu-fg",
  en_analyse: "bg-warning-bg text-warning",
  approuve: "bg-success-bg text-success",
  rejete: "bg-danger-bg text-danger",
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

/**
 * Drapeau emoji d'un code pays ISO-2 (CI → 🇨🇮). Transforme les deux lettres
 * en indicateurs régionaux Unicode. Renvoie "" si le code est invalide.
 */
export function marcheFlag(code: string | null): string {
  if (!code) return "";
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - 65),
    base + (cc.charCodeAt(1) - 65),
  );
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
export type Emotion = (typeof EMOTIONS)[number];

export const EMOTION_LABELS: Record<string, string> = {
  peur: "Peur",
  desir: "Désir",
  statut: "Statut",
  economie: "Économie",
  confort: "Confort",
  curiosite: "Curiosité",
};

export function emotionLabel(code: string | null): string {
  if (!code) return "—";
  return EMOTION_LABELS[code] ?? code;
}

// --- Tri de la page Recherche ---
export const TRIS = {
  score_desc: "Score (meilleur)",
  score_asc: "Score (faible)",
  recent: "Plus récent",
  ancien: "Plus ancien",
  cout_asc: "Coût livré ↑",
  cout_desc: "Coût livré ↓",
} as const;
export type Tri = keyof typeof TRIS;

// --- Type d'approvisionnement ---
export const TYPES_APPRO = [
  { code: "import", label: "Import Chine" },
  { code: "local", label: "Local" },
] as const;
export type TypeAppro = (typeof TYPES_APPRO)[number]["code"];

export function typeApproLabel(code: string | null): string {
  return TYPES_APPRO.find((t) => t.code === code)?.label ?? "Import Chine";
}

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
 *   Local    : prix_achat_local
 *   Aérien   : prix_fournisseur + poids_kg × frais_transit_kilo
 *   Maritime : prix_fournisseur + cbm × frais_transit_cbm
 */
export function coutLivreEstime(input: {
  typeAppro?: TypeAppro;
  mode: ModeTransit;
  prixFournisseur: number | null | undefined;
  prixAchatLocal?: number | null;
  poidsKg?: number | null;
  fraisTransitKilo?: number | null;
  cbm?: number | null;
  fraisTransitCbm?: number | null;
}): number {
  if (input.typeAppro === "local") return input.prixAchatLocal ?? 0;
  const prix = input.prixFournisseur ?? 0;
  if (input.mode === "maritime") {
    return prix + (input.cbm ?? 0) * (input.fraisTransitCbm ?? 0);
  }
  return prix + (input.poidsKg ?? 0) * (input.fraisTransitKilo ?? 0);
}

/**
 * Normalise une URL saisie à la main pour un lien externe cliquable.
 * Ajoute "https://" si le schéma manque (sinon le navigateur la traite comme
 * un lien interne relatif et le clic « ne fait rien »). Retourne null si vide.
 */
export function externalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  return `https://${t}`;
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
