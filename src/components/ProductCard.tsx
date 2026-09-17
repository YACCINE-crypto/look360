import Link from "next/link";
import { Icon } from "./Icon";
import { StatusChip } from "./StatusChip";
import { envoyerEnTest } from "@/app/(app)/recherche/actions";
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

/* eslint-disable @next/next/no-img-element */

export function ProductCard({
  p,
  marge,
  score,
}: {
  p: Produit;
  marge?: number | null;
  score?: number | null;
}) {
  const statut = p.statut as Statut;
  const echeance = prochaineEcheance(p.date_a_travailler, p.date_lancement_testing);
  const echLabel = echeanceLabel(echeance);
  const urgent = echeanceProche(echeance);

  return (
    <article
      className={`bg-surface flex flex-col overflow-hidden rounded-xl border shadow-card ${
        urgent ? "border-warning" : "border-border"
      }`}
    >
      <div className="bg-surface relative aspect-[4/3] w-full">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.nom ?? "Produit"}
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <div className="text-muted-foreground bg-input grid h-full w-full place-items-center">
            <Icon name="image" size={28} />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusChip statut={statut} />
        </div>
        {score != null && (
          <span
            className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreMeta(score).badge}`}
            title="Score produit gagnant (0–100)"
          >
            Score {score} · {scoreMeta(score).label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
        <div>
          {p.categorie && (
            <p className="text-muted-foreground text-xs">{p.categorie}</p>
          )}
          <h3 className="font-semibold leading-snug">{p.nom ?? "Sans nom"}</h3>
          <p className="text-muted-foreground text-xs">{marcheLabel(p.marche)}</p>
          {p.statut_revue !== "approuve" && (
            <span
              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_REVUE_BADGE[p.statut_revue as StatutRevue]}`}
            >
              {STATUT_REVUE_LABELS[p.statut_revue as StatutRevue]}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-muted-foreground text-xs">Coût livré</p>
            <p className="font-semibold">
              {formatFCFA(p.cout_livre_estime)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Marge est.</p>
            <p className={`font-semibold ${margeColorClass(marge ?? null)}`}>
              {marge == null ? "—" : `${marge.toFixed(0)}%`}
            </p>
          </div>
        </div>

        {echLabel && (
          <span
            className={`inline-flex w-fit items-center gap-1 text-xs font-medium ${
              urgent ? "text-warning" : "text-muted-foreground"
            }`}
          >
            <Icon name="clock" size={12} />
            {echLabel}
          </span>
        )}

        <div className="mt-auto pt-1">
          {statut === "en_test" ? (
            <Link
              href={`/testing/${p.id}`}
              className="bg-primary text-primary-foreground flex min-h-[44px] w-full items-center justify-center rounded-md text-center text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Voir le verdict
            </Link>
          ) : statut === "idee" || statut === "a_tester" ? (
            <form action={envoyerEnTest}>
              <input type="hidden" name="id" value={p.id} />
              <button
                type="submit"
                className="bg-primary text-primary-foreground flex min-h-[44px] w-full items-center justify-center rounded-md text-center text-sm font-semibold transition-opacity hover:opacity-90"
              >
                Envoyer en test
              </button>
            </form>
          ) : (
            <Link
              href={`/testing/${p.id}`}
              className="bg-input text-foreground flex min-h-[44px] w-full items-center justify-center rounded-md text-center text-sm font-semibold transition-colors hover:bg-muted"
            >
              Détails
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
