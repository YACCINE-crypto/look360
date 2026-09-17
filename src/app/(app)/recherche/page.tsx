import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/ProductCard";
import { FilterBar } from "@/components/FilterBar";
import { StatsStrip, type Stat } from "@/components/StatsStrip";
import { AddProductPanel } from "@/components/AddProductPanel";
import { SearchBox } from "@/components/SearchBox";
import { PageHeader } from "@/components/ui";
import { margeParProduit } from "@/lib/testing";
import { STATUTS, MARCHES, TRIS, type Statut, type Tri } from "@/lib/produits";

type SearchParams = {
  statut?: string;
  marche?: string;
  tri?: string;
  q?: string;
  error?: string;
};

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
  const q = (sp.q ?? "").trim();

  const supabase = await createClient();

  let query = supabase.from("produits").select("*");
  if (statutFilter) query = query.eq("statut", statutFilter);
  if (marcheFilter) query = query.eq("marche", marcheFilter);
  if (q) query = query.ilike("nom", `%${q}%`);
  switch (tri) {
    case "ancien":
      query = query.order("created_at", { ascending: true });
      break;
    case "cout_asc":
      query = query.order("cout_livre_estime", { ascending: true, nullsFirst: false });
      break;
    case "cout_desc":
      query = query.order("cout_livre_estime", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const [{ data: produits, error }, { data: tousStatuts }, { data: tests }] =
    await Promise.all([
      query,
      supabase.from("produits").select("statut"),
      supabase
        .from("tests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

  const marges = margeParProduit(tests ?? []);
  const stats = buildStats(tousStatuts ?? [], tests ?? []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recherche produit"
        subtitle="Trouvez, évaluez et envoyez les produits prometteurs en test."
      >
        <div className="hidden sm:block">
          <SearchBox />
        </div>
        <AddProductPanel />
      </PageHeader>

      <StatsStrip stats={stats} />

      <FilterBar />

      {sp.error && (
        <p className="bg-danger-bg text-danger rounded-lg p-3 text-sm">
          {sp.error === "nom"
            ? "Le nom du produit est requis."
            : "Impossible d'enregistrer le produit. Réessaie."}
        </p>
      )}
      {error && (
        <p className="bg-danger-bg text-danger rounded-lg p-4 text-sm">
          Erreur de chargement : {error.message}
        </p>
      )}

      {produits && produits.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Aucun produit pour ces filtres.
          </p>
          <Link
            href="/recherche?add=1"
            className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
          >
            Ajouter ton premier produit
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {produits?.map((p) => (
            <ProductCard key={p.id} p={p} marge={marges[p.id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildStats(
  statuts: { statut: string }[],
  tests: { commandes_recues: number | null; commandes_confirmees: number | null }[],
): Stat[] {
  const count = (fn: (s: string) => boolean) =>
    statuts.filter((r) => fn(r.statut)).length;

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
