import Link from "next/link";
import { Icon } from "./Icon";
import { StatusChip } from "./StatusChip";
import { CreativeMedia } from "./CreativeMedia";
import { ProgressRing, MeterBar, CountryFlag, margeTone } from "./dataviz";
import { envoyerEnTest, passerEnProduction } from "@/app/(app)/recherche/actions";
import { margeColorClass } from "@/lib/testing";
import {
  formatFCFA,
  STATUT_LABELS,
  type Produit,
  type Statut,
} from "@/lib/produits";

const COLUMN_ICON: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  idee: "today",
  a_tester: "clock",
  en_test: "flask",
  valide: "check",
  production: "pipeline",
};
const COLUMN_ACCENT: Record<string, string> = {
  idee: "bg-chip-idee text-chip-idee-fg",
  a_tester: "bg-chip-bleu text-chip-bleu-fg",
  en_test: "bg-secondary text-primary",
  valide: "bg-success-bg text-success",
  production: "bg-primary text-primary-foreground",
};

export function PipelineColumn({
  statut,
  produits,
  marges,
  closings,
}: {
  statut: Statut;
  produits: Produit[];
  marges: Record<string, number>;
  closings: Record<string, number>;
}) {
  return (
    <section className="border-border bg-surface flex w-full shrink-0 flex-col rounded-xl border shadow-card lg:w-72">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${COLUMN_ACCENT[statut] ?? "bg-input text-muted-foreground"}`}>
            <Icon name={COLUMN_ICON[statut] ?? "today"} size={16} />
          </span>
          <h2 className="text-sm font-semibold leading-none">{STATUT_LABELS[statut]}</h2>
        </div>
        <span className="bg-input text-muted-foreground rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
          {produits.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {produits.length === 0 && (
          <div className="border-border text-muted-foreground rounded-lg border border-dashed py-6 text-center text-xs">
            <Icon name={COLUMN_ICON[statut] ?? "today"} size={18} className="mx-auto mb-1 opacity-50" />
            Aucun produit ici
          </div>
        )}
        {produits.map((p) => (
          <PipelineCard
            key={p.id}
            p={p}
            marge={marges[p.id] ?? null}
            closing={closings[p.id] ?? null}
          />
        ))}

        <Link
          href="/recherche?add=1"
          className="border-border text-muted-foreground hover:text-primary hover:border-primary/40 mt-auto flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-sm font-medium transition-colors"
        >
          <Icon name="plus" size={14} />
          Ajouter
        </Link>
      </div>
    </section>
  );
}

function PipelineCard({
  p,
  marge,
  closing,
}: {
  p: Produit;
  marge: number | null;
  closing: number | null;
}) {
  const statut = p.statut as Statut;
  return (
    <div className="group border-border bg-surface shadow-card hover:border-primary/40 flex h-full flex-col overflow-hidden rounded-lg border transition-all hover:shadow-lift">
      <div className="relative">
        <CreativeMedia image={p.media_cdn_url ?? p.image_url} alt={p.nom ?? "Produit"} ratio="portrait" />
        <div className="absolute left-1.5 top-1.5 z-10">
          <StatusChip statut={statut} />
        </div>
        {p.marche && (
          <span className="bg-surface/90 text-foreground absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur">
            <CountryFlag code={p.marche} /> {p.marche}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{p.nom ?? "Sans nom"}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            {formatFCFA(p.cout_livre_estime)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ProgressRing value={closing} size={38} stroke={4} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-[10px]">Marge</span>
              <span className={`text-xs font-bold tabular-nums ${margeColorClass(marge)}`}>
                {marge == null ? "—" : `${marge.toFixed(0)}%`}
              </span>
            </div>
            <div className="mt-1">
              <MeterBar value={marge ?? 0} tone={marge == null ? "muted" : margeTone(marge)} height={5} />
            </div>
          </div>
        </div>

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
