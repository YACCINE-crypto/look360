// Les images produit sont des URLs externes arbitraires (Alibaba, etc.) :
// on utilise <img> plutôt que next/image pour éviter la config remotePatterns.
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  STATUTS,
  STATUT_LABELS,
  STATUT_BADGE,
  MARCHES,
  TRIS,
  marcheLabel,
  formatFCFA,
  echeanceProche,
  type Statut,
  type Tri,
  type Produit,
} from "@/lib/produits";
import { envoyerEnTest } from "./actions";
import { DeleteButton } from "./DeleteButton";

type SearchParams = { statut?: string; marche?: string; tri?: string };

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statutFilter = STATUTS.includes(sp.statut as Statut)
    ? (sp.statut as Statut)
    : "";
  const marcheFilter =
    MARCHES.some((m) => m.code === sp.marche) && sp.marche ? sp.marche : "";
  const tri: Tri = (Object.keys(TRIS) as Tri[]).includes(sp.tri as Tri)
    ? (sp.tri as Tri)
    : "recent";

  const supabase = await createClient();
  let query = supabase.from("produits").select("*");

  if (statutFilter) query = query.eq("statut", statutFilter);
  if (marcheFilter) query = query.eq("marche", marcheFilter);

  switch (tri) {
    case "ancien":
      query = query.order("created_at", { ascending: true });
      break;
    case "cout_asc":
      query = query.order("cout_livre_estime", {
        ascending: true,
        nullsFirst: false,
      });
      break;
    case "cout_desc":
      query = query.order("cout_livre_estime", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data: produits, error } = await query;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recherche produit</h1>
          <p className="text-sm text-zinc-500">
            {produits?.length ?? 0} produit
            {(produits?.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/recherche/nouveau"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + Ajouter produit
        </Link>
      </div>

      {/* Filtres + tri (GET form => querystring) */}
      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Statut
          <select
            name="statut"
            defaultValue={statutFilter}
            className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            <option value="">Tous</option>
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {STATUT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Marché
          <select
            name="marche"
            defaultValue={marcheFilter}
            className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            <option value="">Tous</option>
            {MARCHES.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Trier par
          <select
            name="tri"
            defaultValue={tri}
            className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            {(Object.keys(TRIS) as Tri[]).map((t) => (
              <option key={t} value={t}>
                {TRIS[t]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Appliquer
        </button>
        {(statutFilter || marcheFilter || tri !== "recent") && (
          <Link
            href="/recherche"
            className="px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Erreur de chargement : {error.message}
        </p>
      )}

      {produits && produits.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">
            Aucun produit pour ces filtres.
          </p>
          <Link
            href="/recherche/nouveau"
            className="mt-3 inline-block text-sm font-medium underline"
          >
            Ajouter ton premier produit
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {produits?.map((p) => (
          <ProduitCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

function ProduitCard({ p }: { p: Produit }) {
  const statut = p.statut as Statut;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {p.image_url ? (
        <img
          src={p.image_url}
          alt={p.nom ?? "Produit"}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
          Pas d&apos;image
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-snug">{p.nom ?? "Sans nom"}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUT_BADGE[statut]}`}
          >
            {STATUT_LABELS[statut]}
          </span>
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Marché</dt>
            <dd>{marcheLabel(p.marche)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Coût livré</dt>
            <dd className="font-medium">{formatFCFA(p.cout_livre_estime)}</dd>
          </div>
          {p.angle_marketing && (
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Angle</dt>
              <dd className="truncate text-right">{p.angle_marketing}</dd>
            </div>
          )}
        </dl>

        {/* Badges planning */}
        <div className="flex flex-wrap gap-1.5">
          {p.date_a_travailler && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                echeanceProche(p.date_a_travailler)
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              À bosser : {p.date_a_travailler}
            </span>
          )}
          {p.date_lancement_testing && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                echeanceProche(p.date_lancement_testing)
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              Test : {p.date_lancement_testing}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {statut !== "en_test" ? (
            <form action={envoyerEnTest}>
              <input type="hidden" name="id" value={p.id} />
              <button
                type="submit"
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600"
              >
                Envoyer en test
              </button>
            </form>
          ) : (
            <span className="text-xs font-medium text-amber-600">
              En test →
            </span>
          )}
          <DeleteButton id={p.id} />
        </div>
      </div>
    </div>
  );
}
