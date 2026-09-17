import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { marcheLabel, formatFCFA } from "@/lib/produits";

export default async function TestingPage() {
  const supabase = await createClient();
  const { data: produits } = await supabase
    .from("produits")
    .select("*")
    .eq("statut", "en_test")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Testing</h1>
      <p className="text-sm text-zinc-500">
        {produits?.length ?? 0} produit{(produits?.length ?? 0) > 1 ? "s" : ""} en
        test — ouvre une fiche pour saisir les chiffres réels et voir le verdict.
      </p>

      {produits && produits.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          Aucun produit en test.{" "}
          <Link href="/recherche" className="underline">
            Envoie-en un depuis la page Recherche.
          </Link>
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {produits?.map((p) => (
          <Link
            key={p.id}
            href={`/testing/${p.id}`}
            className="group flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <div>
              <p className="font-medium">{p.nom ?? "Sans nom"}</p>
              <p className="text-sm text-zinc-500">
                {marcheLabel(p.marche)} · Coût livré{" "}
                {formatFCFA(p.cout_livre_estime)}
              </p>
            </div>
            <span className="text-sm text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
              Ouvrir →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
