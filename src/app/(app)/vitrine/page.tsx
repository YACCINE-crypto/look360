import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { planConfig } from "@/lib/billing";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { FeatureLock } from "@/components/FeatureLock";
import { marcheLabel } from "@/lib/produits";

export const dynamic = "force-dynamic";

// Lignes 100% ANONYMISÉES renvoyées par la fonction SECURITY DEFINER
// public.vitrine_winners() : jamais d'user_id, jamais de nom de produit.
type Winner = {
  categorie: string | null;
  marche: string | null;
  marge_pct: number | null;
  closing_pct: number | null;
  validated_at: string;
};

export default async function VitrinePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  // ── Gating RÉEL côté serveur : donnée premium réservée au plan Business.
  const sub = await getSubscription(userId);
  if (!planConfig(sub?.plan).vitrineEnabled) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Vitrine des winners validés"
          subtitle="Les produits déjà validés par la communauté de commerçants Look360."
        />
        <FeatureLock
          title="Vitrine des winners validés"
          minPlan="Business"
          description="Accédez aux produits validés par les autres commerçants Look360 — une longueur d'avance sur ce qui marche déjà sur le terrain. Donnée premium, incluse uniquement dans l'offre Business."
        />
      </div>
    );
  }

  // Lecture inter-comptes via la fonction SECURITY DEFINER : elle n'expose
  // QUE des agrégats anonymisés (catégorie, pays, marge %, closing %), exclut
  // les produits de l'appelant, respecte l'opt-out des propriétaires et ne
  // renvoie des lignes qu'aux comptes Business. Aucune identité ne transite.
  const { data } = await supabase.rpc("vitrine_winners");
  const rows = (data ?? []) as Winner[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vitrine des winners validés"
        subtitle="Les produits validés par la communauté (≥ 10 commandes reçues), 100 % anonymisés — inspirez-vous de ce qui gagne."
      >
        <span className="bg-secondary text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
          <Icon name="store" size={14} /> Business
        </span>
      </PageHeader>

      {rows.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <span className="bg-secondary text-primary mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full">
            <Icon name="store" size={24} />
          </span>
          <p className="font-medium">Aucun winner validé pour l&apos;instant</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Dès que des commerçants valident des produits (≥ 10 commandes
            reçues), ils apparaissent ici, sans jamais révéler leur identité.
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {rows.length} winner{rows.length > 1 ? "s" : ""} validé
            {rows.length > 1 ? "s" : ""} · données anonymisées
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((w, i) => (
              <article
                key={i}
                className="bg-surface border-border shadow-card flex flex-col gap-3 rounded-xl border p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold">
                    {w.categorie ?? "Catégorie"}
                  </span>
                  <span className="bg-success-bg text-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    <Icon name="check" size={11} strokeWidth={3} /> Validé
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Marché : {marcheLabel(w.marche)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-background rounded-lg p-2.5 text-center">
                    <p className="text-success text-lg font-extrabold tabular-nums">
                      {w.closing_pct ?? "—"} %
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      Taux de closing
                    </p>
                  </div>
                  <div className="bg-background rounded-lg p-2.5 text-center">
                    <p className="text-primary text-lg font-extrabold tabular-nums">
                      {w.marge_pct ?? "—"} %
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      Marge nette
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground/70 text-[10px]">
                  Commerçant anonyme · validé le{" "}
                  {new Date(w.validated_at).toLocaleDateString("fr-FR")}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
