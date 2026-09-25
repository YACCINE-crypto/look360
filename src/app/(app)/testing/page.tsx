import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/ui";
import { EmptyPreview, CountryFlag } from "@/components/dataviz";
import { marcheLabel, formatFCFA } from "@/lib/produits";
import { computeTest, margeColorClass, type Test } from "@/lib/testing";
import { dernierTestParProduit } from "@/lib/score";

/* eslint-disable @next/next/no-img-element */

// Verdict → pastille (tokens signal : vert / ambre / rouge).
function verdictPill(tier: string | null): { label: string; cls: string } {
  if (tier === "rentable") return { label: "Rentable", cls: "bg-success-bg text-success" };
  if (tier === "moyen") return { label: "Moyen", cls: "bg-warning-bg text-warning" };
  if (tier === "pas_rentable" || tier === "marge_faible")
    return { label: "Pas rentable", cls: "bg-danger-bg text-danger" };
  return { label: "À chiffrer", cls: "bg-input text-muted-foreground" };
}
function closingColor(tier: string | undefined): string {
  if (tier === "faible") return "text-danger";
  if (tier === "correct") return "text-warning";
  if (tier === "normal" || tier === "super") return "text-success";
  return "text-muted-foreground";
}

export default async function TestingPage() {
  const supabase = await createClient();
  const [{ data: produits }, { data: testsData }] = await Promise.all([
    supabase
      .from("produits")
      .select("*")
      .eq("statut", "en_test")
      .order("created_at", { ascending: false }),
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
  ]);

  const derniers = dernierTestParProduit((testsData ?? []) as Test[]);
  const total = produits?.length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tests"
        subtitle={`${total} produit${total > 1 ? "s" : ""} en test — verdict visible directement sur la carte.`}
      />

      {total === 0 ? (
        <EmptyPreview
          icon="flask"
          title="Aucun produit en test"
          description="Envoie un produit en test depuis la Recherche : closing, marge et verdict s'afficheront ici en direct."
          ctaHref="/recherche"
          ctaLabel="Aller à la Recherche"
          variant="list"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {produits?.map((p) => {
            const dernier = derniers[p.id];
            const r = dernier
              ? computeTest({
                  prix_vente_prevu: dernier.prix_vente_prevu,
                  commandes_recues: dernier.commandes_recues,
                  commandes_confirmees: dernier.commandes_confirmees,
                  depense_pub: dernier.depense_pub,
                  cout_produit_estime: dernier.cout_produit_estime,
                  frais_livraison_prevu: dernier.frais_livraison_prevu,
                })
              : null;
            const pill = verdictPill(r?.verdict?.tier ?? null);
            const img = p.media_cdn_url ?? p.image_url;

            return (
              <Link
                key={p.id}
                href={`/testing/${p.id}`}
                className="group border-border bg-surface hover:border-primary/40 hover:shadow-md flex gap-3 rounded-xl border p-3 shadow-card transition-all"
              >
                {/* Vignette */}
                <div className="bg-input relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                  {img ? (
                    <img src={img} alt={p.nom ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground grid h-full w-full place-items-center">
                      <Icon name="image" size={24} />
                    </div>
                  )}
                  <span className={`absolute left-1 top-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pill.cls}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {pill.label}
                  </span>
                </div>

                {/* Contenu */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold leading-snug">{p.nom ?? "Sans nom"}</p>
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <CountryFlag code={p.marche} /> {marcheLabel(p.marche)}
                      </p>
                    </div>
                    <Icon name="chevronRight" size={16} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-[11px]">Coût livré</p>
                      <p className="truncate text-sm font-semibold">{formatFCFA(p.cout_livre_estime)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-[11px]">Marge est.</p>
                      <p className={`text-sm font-semibold ${margeColorClass(r?.margePct ?? null)}`}>
                        {r?.margePct == null ? "—" : `${r.margePct.toFixed(0)}%`}
                      </p>
                    </div>
                  </div>

                  {/* Taux de closing (barre) */}
                  {r?.tauxConfirmation != null ? (
                    <div className="mt-2">
                      <div className="mb-0.5 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Closing</span>
                        <span className={`font-semibold ${closingColor(r.confirmation?.tier)}`}>
                          {r.tauxConfirmation.toFixed(0)}%
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full ${
                            r.confirmation?.tier === "faible"
                              ? "bg-danger"
                              : r.confirmation?.tier === "correct"
                                ? "bg-warning"
                                : "bg-success"
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, r.tauxConfirmation))}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-2 text-[11px]">
                      Chiffres non saisis — ouvre la fiche.
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
