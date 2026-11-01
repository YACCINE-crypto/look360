import { createClient } from "@/lib/supabase/server";
import { getFeed } from "@/lib/feed";
import { PageHeader } from "@/components/ui";
import { FeedClient } from "./FeedClient";
import { EmptyState } from "@/components/EmptyState";
import { Sparkles } from "lucide-react";
import { UnlockMore } from "@/components/shops/ShopCards";
import { currentAccess, FREE_PREVIEW } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * Recherche = Feed du jour : pubs gagnantes repérées chaque matin, communes à
 * tous (offre gratuite : 5 pubs). Les produits enregistrés sont sur « Mes produits ».
 */
export default async function RecherchePage() {
  const supabase = await createClient();
  const [feed, { paid }] = await Promise.all([
    getFeed(supabase, { limit: 60 }), // lecture RLS authenticated
    currentAccess(),
  ]);
  // Offre gratuite : aperçu des 5 meilleures pubs du jour.
  const visible = paid ? feed : feed.slice(0, FREE_PREVIEW);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feed du jour"
        subtitle={`${feed.length} pubs actives repérées ce matin, en Afrique et en Europe, triées par score.`}
      >
        <span className="bg-secondary text-accent inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold">
          Ne consomme aucune recherche
        </span>
      </PageHeader>

      {feed.length > 0 ? (
        <>
          <FeedClient ads={visible} />
          {!paid && feed.length > FREE_PREVIEW && <UnlockMore what="pubs du jour" total={feed.length} />}
        </>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Le feed se prépare"
          description="Les pubs gagnantes du jour sont collectées chaque matin. Reviens un peu plus tard, ou lance ta propre recherche dans le Spy."
          ctaHref="/spy"
          ctaLabel="Ouvrir le Spy"
        />
      )}
    </div>
  );
}
