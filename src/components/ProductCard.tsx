import Link from "next/link";
import { Icon } from "./Icon";
import { StatusChip } from "./StatusChip";
import { ProductActions } from "./ProductActions";
import { CreativeMedia } from "./CreativeMedia";
import { ProgressRing, MeterBar, CountryFlag, margeTone } from "./dataviz";
import { margeColorClass } from "@/lib/testing";
import { scoreMeta } from "@/lib/score";
import {
  marcheLabel,
  formatFCFA,
  echeanceLabel,
  echeanceProche,
  prochaineEcheance,
  STATUT_REVUE_LABELS,
  STATUT_REVUE_BADGE,
  type Produit,
  type Statut,
  type StatutRevue,
} from "@/lib/produits";

export function ProductCard({
  p,
  marge,
  score,
  closing,
}: {
  p: Produit;
  marge?: number | null;
  score?: number | null;
  closing?: number | null;
}) {
  const statut = p.statut as Statut;
  const echeance = prochaineEcheance(p.date_a_travailler, p.date_lancement_testing);
  const echLabel = echeanceLabel(echeance);
  const urgent = echeanceProche(echeance);
  const hasMarge = marge != null;
  const hasClosing = closing != null;

  return (
    <article
      className={`bg-surface relative flex h-full flex-col overflow-hidden rounded-xl border shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        urgent ? "border-warning" : statut === "en_test" ? "border-primary/30" : "border-border"
      }`}
    >
      {/* Toute la carte est cliquable vers la page détail (lien étiré).
          Les boutons d'action passent au-dessus (z-20) et restent indépendants. */}
      <Link
        href={`/produits/${p.id}`}
        aria-label={`Ouvrir ${p.nom ?? "le produit"}`}
        className="absolute inset-0 z-10"
      />

      <CreativeMedia image={p.media_cdn_url ?? p.image_url} alt={p.nom ?? "Produit"}>
        <div className="absolute left-2 top-2 z-20">
          <StatusChip statut={statut} />
        </div>
        {score != null && (
          <span
            className={`absolute right-2 top-2 z-20 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${scoreMeta(score).badge}`}
            title="Score produit gagnant (0–100)"
          >
            {score} · {scoreMeta(score).label}
          </span>
        )}
        {p.marche && (
          <span className="bg-surface/90 text-foreground absolute bottom-2 left-2 z-20 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur">
            <CountryFlag code={p.marche} /> {p.marche}
          </span>
        )}
        <ProductActions
          id={p.id}
          nom={p.nom}
          dateATravailler={p.date_a_travailler}
          dateLancementTesting={p.date_lancement_testing}
        />
      </CreativeMedia>

      <div className="flex flex-1 flex-col gap-2.5 border-t border-border p-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-snug" title={p.nom ?? ""}>
            {p.nom ?? "Sans nom"}
          </h3>
          <p className="text-muted-foreground truncate text-xs">
            {p.categorie ? `${p.categorie} · ` : ""}
            {marcheLabel(p.marche)}
          </p>
        </div>

        {/* Bloc data : closing (anneau) + marge (jauge) + coût */}
        <div className="flex items-center gap-3">
          <ProgressRing value={hasClosing ? closing! : null} size={48} stroke={5} sublabel="closing" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-[11px]">Marge est.</span>
              <span className={`text-sm font-bold tabular-nums ${margeColorClass(marge ?? null)}`}>
                {hasMarge ? `${marge!.toFixed(0)}%` : "—"}
              </span>
            </div>
            <MeterBar value={hasMarge ? marge! : 0} tone={hasMarge ? margeTone(marge) : "muted"} height={6} />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-[11px]">Coût livré</span>
              <span className="text-foreground truncate text-xs font-semibold">
                {formatFCFA(p.cout_livre_estime)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-[18px] flex-wrap items-center gap-1.5">
          {p.statut_revue !== "approuve" && (
            <span
              className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUT_REVUE_BADGE[p.statut_revue as StatutRevue]}`}
            >
              {STATUT_REVUE_LABELS[p.statut_revue as StatutRevue]}
            </span>
          )}
          {echLabel && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                urgent ? "text-warning" : "text-muted-foreground"
              }`}
            >
              <Icon name="clock" size={11} />
              {echLabel}
            </span>
          )}
        </div>

        <div className="relative z-20 mt-auto pt-0.5">
          {statut === "en_test" ? (
            <Link
              href={`/testing/${p.id}`}
              className="bg-primary text-primary-foreground flex min-h-[40px] w-full items-center justify-center rounded-md text-center text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Voir le verdict
            </Link>
          ) : statut === "idee" || statut === "a_tester" ? (
            <Link
              href={`/produits/${p.id}/envoyer-test`}
              className="bg-primary text-primary-foreground flex min-h-[40px] w-full items-center justify-center rounded-md text-center text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Envoyer en test
            </Link>
          ) : (
            <Link
              href={`/testing/${p.id}`}
              className="bg-input text-foreground flex min-h-[40px] w-full items-center justify-center rounded-md text-center text-sm font-semibold transition-colors hover:bg-muted"
            >
              Voir le test
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
