import { createClient } from "@/lib/supabase/server";
import { AujourdhuiView, type AujourdhuiData } from "./AujourdhuiView";
import { computeTest, type Test, type TestResult } from "@/lib/testing";
import { dernierTestParProduit } from "@/lib/score";
import {
  prochaineEcheance,
  joursRestants,
  type Produit,
} from "@/lib/produits";

const DECIDED = new Set(["valide", "production", "abandonne"]);

function resultOf(t: Test): TestResult {
  return computeTest({
    prix_vente_prevu: t.prix_vente_prevu,
    commandes_recues: t.commandes_recues,
    commandes_confirmees: t.commandes_confirmees,
    depense_pub: t.depense_pub,
    cout_produit_estime: t.cout_produit_estime,
    frais_livraison_prevu: t.frais_livraison_prevu,
  });
}

export default async function AujourdhuiPage() {
  const supabase = await createClient();
  const [{ data: produitsData }, { data: testsData }] = await Promise.all([
    supabase.from("produits").select("*").order("created_at", { ascending: false }),
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
  ]);
  const produits: Produit[] = produitsData ?? [];
  const tests: Test[] = testsData ?? [];
  const derniers = dernierTestParProduit(tests);

  // --- KPIs ---
  const enTest = produits.filter((p) => p.statut === "en_test").length;
  const enProduction = produits.filter((p) => p.statut === "production").length;

  const decided = produits.filter((p) => DECIDED.has(p.statut));
  const valides = decided.filter((p) => p.statut !== "abandonne");
  const tauxValidation = decided.length > 0 ? (valides.length / decided.length) * 100 : null;

  const margesValides = valides
    .map((p) => (derniers[p.id] ? resultOf(derniers[p.id]).margePct : null))
    .filter((m): m is number => m !== null);
  const margeMoyenne =
    margesValides.length > 0
      ? margesValides.reduce((a, b) => a + b, 0) / margesValides.length
      : null;

  // --- Produit du jour : en test, verdict disponible, le plus urgent ---
  const candidats = produits
    .filter((p) => p.statut === "en_test" && derniers[p.id])
    .map((p) => {
      const ech = prochaineEcheance(p.date_a_travailler, p.date_lancement_testing);
      return { p, ech, r: resultOf(derniers[p.id]), jours: joursRestants(ech) };
    })
    .sort((a, b) => {
      const ja = a.jours ?? Infinity;
      const jb = b.jours ?? Infinity;
      if (ja !== jb) return ja - jb;
      return (b.r.beneficeProjete ?? 0) - (a.r.beneficeProjete ?? 0);
    });
  const duJour = candidats[0]
    ? { p: candidats[0].p, ech: candidats[0].ech, r: candidats[0].r }
    : null;

  // Horodatage du rendu (server component).
  const now = new Date();

  // --- Score de la semaine (tests des 7 derniers jours, classés par verdict) ---
  const since = now.getTime() - 7 * 86_400_000;
  const semaineTests = tests.filter((t) => new Date(t.created_at).getTime() >= since);
  let sValides = 0;
  let sRejetes = 0;
  let sAttente = 0;
  for (const t of semaineTests) {
    const v = resultOf(t).verdict?.tier;
    if (v === "rentable") sValides++;
    else if (v === "pas_rentable" || v === "marge_faible") sRejetes++;
    else sAttente++;
  }

  // --- Prochaines échéances ---
  const echeances = produits
    .filter(
      (p) =>
        !DECIDED.has(p.statut) &&
        prochaineEcheance(p.date_a_travailler, p.date_lancement_testing),
    )
    .map((p) => {
      const ech = prochaineEcheance(p.date_a_travailler, p.date_lancement_testing)!;
      return { p, ech, jours: joursRestants(ech) ?? 0 };
    })
    .sort((a, b) => a.jours - b.jours)
    .slice(0, 5)
    .map(({ p, ech }) => ({ p, ech }));

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  const data: AujourdhuiData = {
    dateLabel,
    heure,
    pendingCount: candidats.length,
    kpis: { enTest, tauxValidation, margeMoyenne, enProduction },
    duJour,
    semaine: {
      lances: semaineTests.length,
      valides: sValides,
      rejetes: sRejetes,
      attente: sAttente,
    },
    echeances,
  };

  return <AujourdhuiView data={data} />;
}
