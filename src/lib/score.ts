import type { Produit } from "@/lib/produits";
import { computeTest, type Test } from "@/lib/testing";

/**
 * Score « produit gagnant » 0–100 (transparent, basé sur les signaux du plan).
 *
 *  A. Ancienneté pub concurrent (0–30) — signal produit gagnant (§3) :
 *     plus la pub du concurrent tourne depuis longtemps, mieux c'est.
 *  B. Preuve concurrent (0–15) — lien concurrent / Ad Library renseignés.
 *  C. Test réel (0–40) — taux de confirmation + marge du dernier test.
 *  D. Complétude de la fiche (0–15) — image, angle, émotion, marché.
 */
export type ScoreDetail = {
  total: number;
  ancienntePub: number;
  preuve: number;
  test: number;
  fiche: number;
};

function joursDepuis(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

export function computeScore(p: Produit, dernierTest?: Test | null): ScoreDetail {
  // A. Ancienneté pub concurrent (90 j et + = plein)
  const age = joursDepuis(p.date_debut_pub_concurrent);
  const ancienntePub =
    age === null ? 0 : Math.max(0, Math.min(30, (age / 90) * 30));

  // B. Preuve concurrent
  let preuve = 0;
  if (p.lien_concurrent) preuve += 8;
  if (p.lien_ad_library) preuve += 7;

  // C. Test réel
  let test = 0;
  if (dernierTest) {
    const r = computeTest({
      prix_vente_prevu: dernierTest.prix_vente_prevu,
      commandes_recues: dernierTest.commandes_recues,
      commandes_confirmees: dernierTest.commandes_confirmees,
      depense_pub: dernierTest.depense_pub,
      cout_produit_estime: dernierTest.cout_produit_estime,
      frais_livraison_prevu: dernierTest.frais_livraison_prevu,
    });
    // Confirmation : faible 0 · correct 8 · normal 15 · super 20
    if (r.confirmation) {
      const c = { faible: 0, correct: 8, normal: 15, super: 20 };
      test += c[r.confirmation.tier];
    }
    // Marge : pas_rentable/marge_faible 0 · moyen 10 · rentable 20
    if (r.verdict) {
      const m = { pas_rentable: 0, marge_faible: 0, moyen: 10, rentable: 20 };
      test += m[r.verdict.tier];
    }
  }

  // D. Complétude de la fiche
  let fiche = 0;
  if (p.image_url) fiche += 5;
  if (p.angle_marketing) fiche += 4;
  if (p.emotion_tag) fiche += 3;
  if (p.marche) fiche += 3;

  const total = Math.round(ancienntePub + preuve + test + fiche);
  return { total, ancienntePub: Math.round(ancienntePub), preuve, test, fiche };
}

/** Dernier test par produit (tests triés du + récent au + ancien). */
export function dernierTestParProduit(tests: Test[]): Record<string, Test> {
  const map: Record<string, Test> = {};
  for (const t of tests) {
    if (!(t.produit_id in map)) map[t.produit_id] = t;
  }
  return map;
}

/** Map produit_id -> score total. */
export function scoreParProduit(
  produits: Produit[],
  tests: Test[],
): Record<string, number> {
  const derniers = dernierTestParProduit(tests);
  const out: Record<string, number> = {};
  for (const p of produits) {
    out[p.id] = computeScore(p, derniers[p.id]).total;
  }
  return out;
}

/** Libellé + couleur du score (signal). */
export function scoreMeta(score: number): { label: string; badge: string } {
  if (score >= 70)
    return {
      label: "Fort",
      badge: "bg-success-bg text-success",
    };
  if (score >= 40)
    return {
      label: "Moyen",
      badge: "bg-warning-bg text-warning",
    };
  return { label: "Faible", badge: "bg-input text-muted-foreground" };
}
