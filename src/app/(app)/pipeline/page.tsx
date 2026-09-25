import { createClient } from "@/lib/supabase/server";
import { PipelineColumn } from "@/components/PipelineColumn";
import { PageHeader } from "@/components/ui";
import { EmptyPreview } from "@/components/dataviz";
import { margeParProduit, closingParProduit } from "@/lib/testing";
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
  const closings = closingParProduit(tests ?? []);
  const parStatut = (s: Statut): Produit[] =>
    (produits ?? []).filter((p) => p.statut === s);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline des produits"
        subtitle="Suivi complet du flux : idée → production."
      />

      {(produits?.length ?? 0) === 0 ? (
        <EmptyPreview
          icon="pipeline"
          title="Ton pipeline est vide"
          description="Chaque produit avance ici de l'idée à la production. Ajoute-en un pour voir le flux se remplir."
          ctaHref="/recherche?add=1"
          ctaLabel="Ajouter un produit"
          variant="board"
        />
      ) : (
        /* Desktop : colonnes horizontales scrollables ; mobile : empilé */
        <div className="flex flex-col gap-4 lg:flex-row lg:overflow-x-auto lg:pb-4">
          {COLONNES.map((s) => (
            <PipelineColumn
              key={s}
              statut={s}
              produits={parStatut(s)}
              marges={marges}
              closings={closings}
            />
          ))}
        </div>
      )}
    </div>
  );
}
