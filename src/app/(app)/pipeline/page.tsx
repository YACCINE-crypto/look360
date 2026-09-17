import { createClient } from "@/lib/supabase/server";
import { PipelineColumn } from "@/components/PipelineColumn";
import { PageHeader } from "@/components/ui";
import { margeParProduit } from "@/lib/testing";
import { type Produit, type Statut } from "@/lib/produits";

const COLONNES: Statut[] = [
  "idee",
  "a_tester",
  "en_test",
  "valide",
  "production",
];

export default async function PipelinePage() {
  const supabase = await createClient();
  const [{ data: produits }, { data: tests }] = await Promise.all([
    supabase
      .from("produits")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
  ]);

  const marges = margeParProduit(tests ?? []);
  const parStatut = (s: Statut): Produit[] =>
    (produits ?? []).filter((p) => p.statut === s);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline des produits"
        subtitle="Suivi complet du flux : idée → production."
      />

      {/* Desktop : colonnes horizontales scrollables ; mobile : empilé */}
      <div className="flex flex-col gap-4 lg:flex-row lg:overflow-x-auto lg:pb-4">
        {COLONNES.map((s) => (
          <PipelineColumn
            key={s}
            statut={s}
            produits={parStatut(s)}
            marges={marges}
          />
        ))}
      </div>
    </div>
  );
}
