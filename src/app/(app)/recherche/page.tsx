import { createClient } from "@/lib/supabase/server";
import { RechercheClient } from "./RechercheClient";
import type { Stat } from "@/components/StatsStrip";
import { margeParProduit } from "@/lib/testing";

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
  const stats = buildStats(produits ?? [], tests ?? []);

  return (
    <RechercheClient
      produits={produits ?? []}
      marges={marges}
      stats={stats}
      addError={error}
    />
  );
}

function buildStats(
  produits: { statut: string }[],
  tests: { commandes_recues: number | null; commandes_confirmees: number | null }[],
): Stat[] {
  const count = (fn: (s: string) => boolean) =>
    produits.filter((r) => fn(r.statut)).length;

  const enSuivi = count((s) => ["idee", "a_tester", "en_test"].includes(s));
  const enTest = count((s) => s === "en_test");
  const valides = count((s) => s === "valide");

  let recues = 0;
  let confirmees = 0;
  for (const t of tests) {
    recues += t.commandes_recues ?? 0;
    confirmees += t.commandes_confirmees ?? 0;
  }
  const tauxMoyen = recues > 0 ? (confirmees / recues) * 100 : null;

  return [
    { label: "En suivi", value: String(enSuivi), icon: "pipeline" },
    { label: "En test", value: String(enTest), icon: "flask", valueClass: "text-primary" },
    { label: "Validés", value: String(valides), icon: "check", valueClass: "text-success" },
    {
      label: "Taux closing moy.",
      value: tauxMoyen === null ? "—" : `${tauxMoyen.toFixed(0)} %`,
      icon: "search",
      valueClass: tauxMoyen !== null && tauxMoyen >= 45 ? "text-success" : "",
    },
  ];
}
