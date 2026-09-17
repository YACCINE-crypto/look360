import Link from "next/link";
import { ProduitForm } from "./ProduitForm";

export default async function NouveauProduitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/recherche"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← Recherche
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Ajouter un produit
      </h1>
      <ProduitForm error={error} />
    </div>
  );
}
