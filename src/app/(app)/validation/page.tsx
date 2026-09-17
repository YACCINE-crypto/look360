import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  marcheLabel,
  formatFCFA,
  STATUT_REVUE_LABELS,
  STATUT_REVUE_BADGE,
  type StatutRevue,
} from "@/lib/produits";
import { approuver, rejeter, mettreEnAnalyse } from "./actions";

type Row = {
  id: string;
  nom: string | null;
  marche: string | null;
  categorie: string | null;
  cout_livre_estime: number | null;
  angle_marketing: string | null;
  created_at: string;
  statut_revue: string;
  auteur: { nom: string | null } | null;
};

export default async function ValidationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/recherche");

  const { data } = await supabase
    .from("produits")
    .select(
      "id, nom, marche, categorie, cout_livre_estime, angle_marketing, created_at, statut_revue, auteur:profiles!produits_soumis_par_fkey(nom)",
    )
    .in("statut_revue", ["soumis", "en_analyse"])
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Validation des soumissions"
        subtitle={`${rows.length} produit${rows.length > 1 ? "s" : ""} en attente de revue.`}
      />

      {rows.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <span className="bg-secondary text-primary mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full">
            <Icon name="check" size={24} />
          </span>
          <p className="text-muted-foreground text-sm">
            Rien à valider — toutes les soumissions sont traitées.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <article
              key={p.id}
              className="border-border bg-surface shadow-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{p.nom ?? "Sans nom"}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_REVUE_BADGE[p.statut_revue as StatutRevue]}`}
                  >
                    {STATUT_REVUE_LABELS[p.statut_revue as StatutRevue]}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Soumis par{" "}
                  <span className="text-foreground font-medium">
                    {p.auteur?.nom ?? "—"}
                  </span>{" "}
                  · {marcheLabel(p.marche)} · {formatFCFA(p.cout_livre_estime)}
                </p>
                {p.angle_marketing && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    « {p.angle_marketing} »
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {p.statut_revue !== "en_analyse" && (
                  <form action={mettreEnAnalyse}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="border-border hover:bg-input inline-flex min-h-[44px] items-center rounded-md border px-3 text-sm font-medium">
                      En analyse
                    </button>
                  </form>
                )}
                <form action={rejeter}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-danger border-danger/40 hover:bg-danger-bg inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-sm font-semibold">
                    <Icon name="x" size={15} /> Rejeter
                  </button>
                </form>
                <form action={approuver}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="bg-success text-primary-foreground inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-opacity hover:opacity-90">
                    <Icon name="check" size={15} /> Approuver
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
