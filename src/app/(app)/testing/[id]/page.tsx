import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  STATUT_LABELS,
  STATUT_BADGE,
  marcheLabel,
  formatFCFA,
  type Statut,
} from "@/lib/produits";
import { verdictMeta } from "@/lib/testing";
import { TestForm } from "./TestForm";
import {
  validerProduit,
  abandonnerProduit,
  deleteTest,
} from "../actions";

export default async function FicheTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;

  const supabase = await createClient();
  const { data: produit } = await supabase
    .from("produits")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!produit) notFound();

  const { data: tests } = await supabase
    .from("tests")
    .select("*")
    .eq("produit_id", id)
    .order("created_at", { ascending: false });

  const statut = produit.statut as Statut;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/testing"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← Testing
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {produit.nom ?? "Sans nom"}
          </h1>
          <p className="text-sm text-zinc-500">
            {marcheLabel(produit.marche)} · Coût livré{" "}
            {formatFCFA(produit.cout_livre_estime)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUT_BADGE[statut]}`}
        >
          {STATUT_LABELS[statut]}
        </span>
      </div>

      {/* Décision produit */}
      <div className="mt-4 flex gap-2">
        <form action={validerProduit}>
          <input type="hidden" name="produit_id" value={produit.id} />
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Valider
          </button>
        </form>
        <form action={abandonnerProduit}>
          <input type="hidden" name="produit_id" value={produit.id} />
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:bg-red-950"
          >
            Abandonner
          </button>
        </form>
      </div>

      {/* Tests déjà enregistrés */}
      {tests && tests.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-500">
            Tests enregistrés ({tests.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {tests.map((t) => {
              const vm = verdictMeta(t.verdict);
              const taux =
                t.commandes_recues && t.commandes_recues > 0
                  ? ((t.commandes_confirmees ?? 0) / t.commandes_recues) * 100
                  : null;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">
                      {marcheLabel(t.marche)}
                    </span>
                    <span className="text-zinc-500">
                      {taux === null ? "—" : `${taux.toFixed(0)}%`} conf. ·{" "}
                      {t.commandes_confirmees ?? 0}/{t.commandes_recues ?? 0} cmd
                    </span>
                    {vm && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${vm.badge}`}
                      >
                        {vm.label}
                      </span>
                    )}
                  </div>
                  <form action={deleteTest}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="produit_id" value={produit.id} />
                    <button
                      type="submit"
                      className="text-xs text-zinc-400 hover:text-red-600"
                    >
                      Suppr.
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Nouvelle saisie */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500">
          Nouveau test
        </h2>
        <TestForm
          produitId={produit.id}
          defautMarche={produit.marche}
          defautCoutProduit={produit.cout_livre_estime}
          saved={ok === "1"}
          error={error === "save"}
        />
      </section>
    </div>
  );
}
