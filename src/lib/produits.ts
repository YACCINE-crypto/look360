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

// Classes Tailwind pour le badge de statut.
export const STATUT_BADGE: Record<Statut, string> = {
  idee: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  a_tester: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  en_test: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  valide: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  production:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  abandonne: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
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

/**
 * Coût livré estimé (§5). Identique à la colonne générée en base ;
 * utilisé pour l'aperçu live dans le formulaire.
 */
export function coutLivreEstime(
  prixSourcing: number | null | undefined,
  poidsKg: number | null | undefined,
  fraisLogistiquesKilo: number | null | undefined,
): number {
  return (prixSourcing ?? 0) + (poidsKg ?? 0) * (fraisLogistiquesKilo ?? 0);
}

/** Formatage FCFA (pas de décimales). */
export function formatFCFA(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    value,
  ) + " FCFA";
}

/**
 * Badge d'échéance planning : true si la date est aujourd'hui ou dans <= 2 jours
 * (aligné sur la règle des notifs, §6).
 */
export function echeanceProche(dateISO: string | null): boolean {
  if (!dateISO) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateISO + "T00:00:00");
  const diffJours = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  return diffJours <= 2;
}
