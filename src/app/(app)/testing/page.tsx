import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  STATUT_BADGE,
  STATUT_LABELS,
  marcheLabel,
  formatFCFA,
  type Statut,
} from "@/lib/produits";

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
        Produits en cours de test ({produits?.length ?? 0}).
      </p>

      <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        La fiche de test complète (taux de confirmation, bénéfice projeté,
        verdict) arrive à l&apos;étape 3. Pour l&apos;instant, voici les produits
        envoyés en test depuis la page Recherche.
      </div>

      {produits && produits.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          Aucun produit en test.{" "}
          <Link href="/recherche" className="underline">
            Envoie-en un depuis la page Recherche.
          </Link>
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {produits?.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <p className="font-medium">{p.nom ?? "Sans nom"}</p>
              <p className="text-sm text-zinc-500">
                {marcheLabel(p.marche)} · Coût livré{" "}
                {formatFCFA(p.cout_livre_estime)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                STATUT_BADGE[p.statut as Statut]
              }`}
            >
              {STATUT_LABELS[p.statut as Statut]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
