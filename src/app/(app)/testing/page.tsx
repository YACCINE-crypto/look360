import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/ui";
import { marcheLabel, formatFCFA } from "@/lib/produits";
import { margeParProduit, margeColorClass } from "@/lib/testing";

export default async function TestingPage() {
  const supabase = await createClient();
  const [{ data: produits }, { data: tests }] = await Promise.all([
    supabase
      .from("produits")
      .select("*")
      .eq("statut", "en_test")
      .order("created_at", { ascending: false }),
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
  ]);

  const marges = margeParProduit(tests ?? []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tests"
        subtitle={`${produits?.length ?? 0} produit${
          (produits?.length ?? 0) > 1 ? "s" : ""
        } en test — ouvre une fiche pour saisir les chiffres et voir le verdict.`}
      />

      {produits && produits.length === 0 && (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">Aucun produit en test.</p>
          <Link
            href="/recherche"
            className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
          >
            Envoie-en un depuis la page Recherche.
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {produits?.map((p) => {
          const marge = marges[p.id] ?? null;
          return (
            <Link
              key={p.id}
              href={`/testing/${p.id}`}
              className="border-border bg-surface hover:border-primary/40 flex items-center justify-between gap-4 rounded-xl border p-4 shadow-card transition-colors"
            >
              <div>
                <p className="font-semibold">{p.nom ?? "Sans nom"}</p>
                <p className="text-muted-foreground text-sm">
                  {marcheLabel(p.marche)} · {formatFCFA(p.cout_livre_estime)}
                  {marge !== null && (
                    <span className={`ml-2 font-medium ${margeColorClass(marge)}`}>
                      {marge.toFixed(0)}% marge
                    </span>
                  )}
                </p>
              </div>
              <Icon name="chevronRight" size={18} className="text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
