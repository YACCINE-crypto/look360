import { createClient } from "@/lib/supabase/server";
import { PipelineColumn } from "@/components/PipelineColumn";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Pipeline des produits
        </h1>
        <p className="text-muted-foreground text-sm">
          Suivi complet du flux : idée → production.
        </p>
      </div>

      {/* Desktop : colonnes horizontales scrollables ; mobile : empilé */}
      <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-4">
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
