import Link from "next/link";
import { Icon } from "./Icon";
import { envoyerEnTest, passerEnProduction } from "@/app/(app)/recherche/actions";
import { margeColorClass } from "@/lib/testing";
import {
  marcheLabel,
  formatFCFA,
  STATUT_LABELS,
  type Produit,
  type Statut,
} from "@/lib/produits";

/* eslint-disable @next/next/no-img-element */

const COLUMN_ICON: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  idee: "today",
  a_tester: "clock",
  en_test: "flask",
  valide: "check",
  production: "pipeline",
};

export function PipelineColumn({
  statut,
  produits,
  marges,
}: {
  statut: Statut;
  produits: Produit[];
  marges: Record<string, number>;
}) {
  return (
    <section className="border-border bg-surface flex w-full shrink-0 flex-col rounded-xl border shadow-card lg:w-72">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name={COLUMN_ICON[statut] ?? "today"} size={16} className="text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold leading-none">
              {STATUT_LABELS[statut]}
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              {produits.length} produit{produits.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {produits.length === 0 && (
          <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
            Vide
          </p>
        )}
        {produits.map((p) => (
          <PipelineCard key={p.id} p={p} marge={marges[p.id] ?? null} />
        ))}

        <Link
          href="/recherche?add=1"
          className="border-border text-muted-foreground hover:text-primary mt-auto flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-sm font-medium"
        >
          <Icon name="plus" size={14} />
          Ajouter
        </Link>
      </div>
    </section>
  );
}

function PipelineCard({ p, marge }: { p: Produit; marge: number | null }) {
  const statut = p.statut as Statut;
  return (
    <div className="border-border bg-surface overflow-hidden rounded-lg border">
      <div className="bg-input aspect-video w-full">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.nom ?? "Produit"}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="text-muted-foreground grid h-full w-full place-items-center">
            <Icon name="image" size={22} />
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div>
          <p className="truncate text-sm font-semibold">{p.nom ?? "Sans nom"}</p>
          <p className="text-muted-foreground text-xs">
            {formatFCFA(p.cout_livre_estime)} · {marcheLabel(p.marche)}
          </p>
        </div>
        <p className={`text-xs font-semibold ${margeColorClass(marge)}`}>
          {marge == null ? "—" : `${marge.toFixed(0)}% marge`}
        </p>
        <PipelineAction statut={statut} id={p.id} />
      </div>
    </div>
  );
}

function PipelineAction({ statut, id }: { statut: Statut; id: string }) {
  const btn =
    "bg-secondary text-secondary-foreground flex min-h-[44px] w-full items-center justify-center rounded-md text-center text-xs font-semibold transition-colors hover:opacity-90";
  if (statut === "a_tester") {
    return (
      <form action={envoyerEnTest}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className={btn}>
          Envoyer en test
        </button>
      </form>
    );
  }
  if (statut === "en_test") {
    return (
      <Link href={`/testing/${id}`} className={btn}>
        Voir verdict
      </Link>
    );
  }
  if (statut === "valide") {
    return (
      <form action={passerEnProduction}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className={btn}>
          Production
        </button>
      </form>
    );
  }
  if (statut === "production") {
    return (
      <Link href={`/testing/${id}`} className={btn}>
        Détail
      </Link>
    );
  }
  // idee
  return (
    <Link href="/recherche" className={btn}>
      Évaluer
    </Link>
  );
}
