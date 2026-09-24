import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ShareToggle } from "./ShareToggle";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("vitrine_share")
    .eq("id", uid)
    .maybeSingle();
  const share = profile?.vitrine_share ?? true;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Paramètres"
        subtitle="Gère tes préférences de compte."
      />

      <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-secondary text-primary grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                <Icon name="store" size={16} />
              </span>
              <p className="text-foreground font-semibold">
                Partager mes tests validés à la communauté
              </p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Quand tu valides un produit (≥ 10 commandes reçues), il peut
              apparaître dans la <b className="text-foreground">vitrine communautaire</b>{" "}
              des offres Business — <b className="text-foreground">100 % anonymisé</b> :
              seulement la catégorie, le pays, le taux de closing et la marge.
              Jamais ton nom, jamais le nom exact de ton produit, jamais un lien
              vers ta boutique. Tu peux désactiver ce partage à tout moment.
            </p>
          </div>
          <ShareToggle initial={share} />
        </div>
      </div>
    </div>
  );
}
