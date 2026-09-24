import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscription } from "@/lib/credits";
import { planConfig } from "@/lib/billing";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CreativeMedia } from "@/components/CreativeMedia";
import { FeatureLock } from "@/components/FeatureLock";
import { marcheLabel, emotionLabel } from "@/lib/produits";

export const dynamic = "force-dynamic";

// Champs affichés dans la vitrine — VOLONTAIREMENT limités à l'inspiration
// produit. On n'expose JAMAIS l'économie privée d'un autre commerçant
// (coûts, prix fournisseur, marges, liens sources, notes).
type VitrineRow = {
  id: string;
  nom: string | null;
  marche: string | null;
  categorie: string | null;
  angle_marketing: string | null;
  emotion_tag: string | null;
  image_url: string | null;
  media_cdn_url: string | null;
  created_at: string;
};

export default async function VitrinePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  // ── Gating RÉEL côté serveur : la vitrine des winners validés est une
  // donnée premium, réservée au plan Business. Les autres offres voient un
  // cadenas + upsell — aucune donnée n'est lue si l'offre ne l'inclut pas.
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

  // Lecture inter-comptes via service_role (la RLS cloisonne chaque compte à
  // ses propres produits). On ne remonte QUE des produits « validés » et
  // seulement les champs d'inspiration ci-dessus.
  const admin = createAdminClient();
  const { data } = await admin
    .from("produits")
    .select(
      "id, nom, marche, categorie, angle_marketing, emotion_tag, image_url, media_cdn_url, created_at",
    )
    .eq("statut", "valide")
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = (data ?? []) as VitrineRow[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vitrine des winners validés"
        subtitle="Les produits déjà validés par la communauté de commerçants Look360 — inspirez-vous de ce qui gagne."
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
            Dès que des produits sont validés par la communauté, ils
            apparaissent ici pour vous inspirer.
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {rows.length} produit{rows.length > 1 ? "s" : ""} validé
            {rows.length > 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((p) => (
              <article
                key={p.id}
                className="bg-surface border-border shadow-card flex h-full flex-col overflow-hidden rounded-xl border"
              >
                <CreativeMedia
                  image={p.media_cdn_url ?? p.image_url}
                  alt={p.nom ?? "Produit validé"}
                >
                  <span className="bg-success text-primary-foreground absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow">
                    <Icon name="check" size={11} /> Validé
                  </span>
                </CreativeMedia>

                <div className="border-border flex flex-1 flex-col gap-1.5 border-t p-3">
                  <h3
                    className="truncate font-semibold leading-snug"
                    title={p.nom ?? ""}
                  >
                    {p.nom ?? "Sans nom"}
                  </h3>
                  <p className="text-muted-foreground truncate text-xs">
                    {p.categorie ? `${p.categorie} · ` : ""}
                    {marcheLabel(p.marche)}
                  </p>
                  {p.angle_marketing && (
                    <p className="text-muted-foreground mt-auto line-clamp-2 text-xs italic">
                      « {p.angle_marketing} »
                    </p>
                  )}
                  {p.emotion_tag && (
                    <span className="bg-secondary text-primary mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium">
                      {emotionLabel(p.emotion_tag)}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
