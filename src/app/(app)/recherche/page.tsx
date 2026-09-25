import { createClient } from "@/lib/supabase/server";
import { RechercheClient } from "./RechercheClient";
import type { Stat } from "@/components/StatsStrip";
import { margeParProduit, closingParProduit } from "@/lib/testing";
import { scoreParProduit } from "@/lib/score";

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  // Un seul chargement : tous les produits + tests. Le filtrage/tri se fait
  // ensuite côté client (instantané), sans requête au clic.
  const [{ data: produits }, { data: tests }] = await Promise.all([
    supabase.from("produits").select("*").order("created_at", { ascending: false }),
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
  ]);

  const marges = margeParProduit(tests ?? []);
  const closings = closingParProduit(tests ?? []);
  const scores = scoreParProduit(produits ?? [], tests ?? []);
  const stats = buildStats(produits ?? [], tests ?? []);

  return (
    <RechercheClient
      produits={produits ?? []}
      marges={marges}
      closings={closings}
      scores={scores}
      stats={stats}
      addError={error}
    />
  );
}

/** Série hebdomadaire cumulée (8 pts) des produits matchant un prédicat,
 *  basée sur created_at — tendance d'accumulation, 100 % données réelles. */
function weeklyCumulative(
  produits: { statut: string; created_at: string }[],
  match: (s: string) => boolean,
  weeks = 8,
): number[] {
  const now = Date.now();
  const series: number[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const boundary = now - w * 7 * 86_400_000;
    series.push(
      produits.filter(
        (p) => match(p.statut) && new Date(p.created_at).getTime() <= boundary,
      ).length,
    );
  }
  return series;
}

function buildStats(
  produits: { statut: string; created_at: string }[],
  tests: { commandes_recues: number | null; commandes_confirmees: number | null }[],
): Stat[] {
  const count = (fn: (s: string) => boolean) =>
    produits.filter((r) => fn(r.statut)).length;

  const inSuivi = (s: string) => ["idee", "a_tester", "en_test"].includes(s);
  const inTest = (s: string) => s === "en_test";
  const isValide = (s: string) => s === "valide";

  const enSuivi = count(inSuivi);
  const enTest = count(inTest);
  const valides = count(isValide);

  let recues = 0;
  let confirmees = 0;
  for (const t of tests) {
    recues += t.commandes_recues ?? 0;
    confirmees += t.commandes_confirmees ?? 0;
  }
  const tauxMoyen = recues > 0 ? (confirmees / recues) * 100 : null;

  // Tendances : seulement si assez de produits pour être parlant.
  const enough = produits.length >= 3;
  const trend = (m: (s: string) => boolean) =>
    enough ? weeklyCumulative(produits, m) : undefined;

  return [
    { label: "En suivi", value: String(enSuivi), icon: "pipeline", trend: trend(inSuivi), trendTone: "primary" },
    { label: "En test", value: String(enTest), icon: "flask", valueClass: "text-primary", trend: trend(inTest), trendTone: "primary" },
    { label: "Validés", value: String(valides), icon: "check", valueClass: "text-success", trend: trend(isValide), trendTone: "success" },
    {
      label: "Taux closing moy.",
      value: tauxMoyen === null ? "—" : `${tauxMoyen.toFixed(0)} %`,
      icon: "search",
      valueClass: tauxMoyen !== null && tauxMoyen >= 45 ? "text-success" : "",
    },
  ];
}
