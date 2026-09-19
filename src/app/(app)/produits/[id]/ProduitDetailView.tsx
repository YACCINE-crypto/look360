import Link from "next/link";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { StatusChip } from "@/components/StatusChip";
import { computeScore, scoreMeta } from "@/lib/score";
import { margePctFromTest, margeColorClass, type Test } from "@/lib/testing";
import {
  formatFCFA,
  marcheLabel,
  typeApproLabel,
  externalUrl,
  STATUT_REVUE_LABELS,
  STATUT_REVUE_BADGE,
  type Produit,
  type Statut,
  type StatutRevue,
} from "@/lib/produits";

/* eslint-disable @next/next/no-img-element */

function formatDate(dateISO: string | null): string | null {
  if (!dateISO) return null;
  const d = dateISO.length <= 10 ? new Date(dateISO + "T00:00:00") : new Date(dateISO);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);

/** Détail du calcul du coût livré selon le type d'appro / mode de transit. */
function coutBreakdown(p: Produit): { formule: string; lignes: [string, string][] } {
  if (p.type_approvisionnement === "local") {
    return {
      formule: "Coût livré = prix d'achat local",
      lignes: [["Prix d'achat local", formatFCFA(p.prix_achat_local)]],
    };
  }
  if (p.mode_transit === "maritime") {
    return {
      formule: "prix fournisseur + CBM × frais/CBM",
      lignes: [
        ["Prix fournisseur", formatFCFA(p.prix_fournisseur)],
        ["CBM", `${fmt(p.cbm)} m³`],
        ["Frais / CBM", formatFCFA(p.frais_transit_cbm)],
      ],
    };
  }
  return {
    formule: "prix fournisseur + poids × frais/kg",
    lignes: [
      ["Prix fournisseur", formatFCFA(p.prix_fournisseur)],
      ["Poids", `${fmt(p.poids_kg)} kg`],
      ["Frais / kg", formatFCFA(p.frais_transit_kilo)],
    ],
  };
}

export function ProduitDetailView({ p, tests }: { p: Produit; tests: Test[] }) {
  const dernier = tests[0] ?? null;
  const score = computeScore(p, dernier).total;
  const sMeta = scoreMeta(score);
  const marge = dernier ? margePctFromTest(dernier) : null;
  const bd = coutBreakdown(p);

  const liens = [
    { href: externalUrl(p.lien_source), label: "Voir fournisseur", hint: "Alibaba / source" },
    { href: externalUrl(p.lien_concurrent), label: "Voir boutique concurrent", hint: "Boutique" },
    { href: externalUrl(p.lien_ad_library), label: "Voir pub concurrent", hint: "Ad Library" },
  ].filter((l) => l.href);

  const dates = (
    [
      ["À travailler", formatDate(p.date_a_travailler)],
      ["Lancement testing", formatDate(p.date_lancement_testing)],
      ["Début pub concurrent", formatDate(p.date_debut_pub_concurrent)],
      ["Ajouté le", formatDate(p.created_at)],
    ] as [string, string | null][]
  ).filter(([, v]) => v) as [string, string][];

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/recherche"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <Icon name="chevronRight" size={14} className="rotate-180" />
          Recherche produit
        </Link>
        {p.statut === "idee" || p.statut === "a_tester" ? (
          <Link
            href={`/produits/${p.id}/envoyer-test`}
            className="bg-primary text-primary-foreground inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Icon name="flask" size={15} />
            Envoyer en test
          </Link>
        ) : (
          <Link
            href={`/testing/${p.id}`}
            className="bg-primary text-primary-foreground inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Icon name="flask" size={15} />
            {p.statut === "en_test" ? "Voir le verdict" : "Ouvrir la fiche test"}
          </Link>
        )}
      </div>

      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="bg-input relative aspect-square w-full shrink-0 overflow-hidden rounded-xl sm:h-40 sm:w-40">
          {p.media_cdn_url || p.image_url ? (
            <img src={p.media_cdn_url ?? p.image_url ?? ""} alt={p.nom ?? ""} className="h-full w-full object-cover" />
          ) : (
            <div className="text-muted-foreground grid h-full w-full place-items-center">
              <Icon name="image" size={32} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusChip statut={p.statut as Statut} />
            {p.statut_revue !== "approuve" && (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_REVUE_BADGE[p.statut_revue as StatutRevue]}`}
              >
                {STATUT_REVUE_LABELS[p.statut_revue as StatutRevue]}
              </span>
            )}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${sMeta.badge}`}
            >
              Score {score} · {sMeta.label}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{p.nom ?? "Sans nom"}</h1>
          <p className="text-muted-foreground text-sm">
            {p.categorie ? `${p.categorie} · ` : ""}
            {marcheLabel(p.marche)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Coût & rentabilité */}
        <Card className="p-5 lg:col-span-2">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
            Coût & rentabilité
          </p>
          <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-muted-foreground text-xs">Coût livré estimé</p>
              <p className="text-2xl font-bold tabular-nums">{formatFCFA(p.cout_livre_estime)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Marge estimée</p>
              <p className={`text-2xl font-bold tabular-nums ${margeColorClass(marge)}`}>
                {marge == null ? "—" : `${marge.toFixed(0)}%`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Approvisionnement</p>
              <p className="text-sm font-semibold">{typeApproLabel(p.type_approvisionnement)}</p>
            </div>
          </div>
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-xs">
              Détail du calcul · <span className="italic">{bd.formule}</span>
            </p>
            <div className="space-y-1.5">
              {bd.lignes.map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums">{value}</span>
                </div>
              ))}
              <div className="border-border mt-1 flex justify-between border-t pt-1.5 text-sm">
                <span className="font-semibold">Coût livré</span>
                <span className="font-bold tabular-nums">{formatFCFA(p.cout_livre_estime)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Infos + dates */}
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Informations
            </p>
            <dl className="space-y-1.5 text-sm">
              <Row label="Marché" value={marcheLabel(p.marche)} />
              <Row label="Catégorie" value={p.categorie ?? "—"} />
              <Row label="Statut" value={<StatusChip statut={p.statut as Statut} />} />
            </dl>
          </div>
          {dates.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Dates
              </p>
              <dl className="space-y-1.5 text-sm">
                {dates.map(([label, value]) => (
                  <Row key={label} label={label} value={value} />
                ))}
              </dl>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Angle marketing */}
        {p.angle_marketing && (
          <Card className="p-5 lg:col-span-2">
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Angle marketing
            </p>
            <p className="text-sm">{p.angle_marketing}</p>
          </Card>
        )}

        {/* Liens */}
        <Card className={`p-5 ${p.angle_marketing ? "" : "lg:col-span-3"}`}>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Liens
          </p>
          {liens.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun lien enregistré.</p>
          ) : (
            <div className="space-y-2">
              {liens.map((l) => (
                <a
                  key={l.label}
                  href={l.href!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border hover:bg-input flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                >
                  <span className="text-primary flex items-center gap-2 font-medium">
                    <Icon name="chevronRight" size={14} />
                    {l.label}
                  </span>
                  <span className="text-muted-foreground text-xs">{l.hint}</span>
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>

      {p.notes && (
        <Card className="p-5">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Notes
          </p>
          <p className="text-sm whitespace-pre-line">{p.notes}</p>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
