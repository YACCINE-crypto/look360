import { createClient } from "@/lib/supabase/server";
import { getFeed } from "@/lib/feed";
import { PageHeader } from "@/components/ui";
import { AdGrid } from "@/components/AdGrid";
import { EmptyState } from "@/components/EmptyState";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Recherche = Feed du jour : pubs gagnantes repérées chaque matin, communes à
 * tous, gratuites. Les produits enregistrés sont sur « Mes produits ».
 */
export default async function RecherchePage() {
  const supabase = await createClient();
  const feed = await getFeed(supabase, { limit: 48 }); // lecture RLS authenticated

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feed du jour"
        subtitle="Pubs gagnantes repérées pour toi — à parcourir librement."
      >
        <span className="bg-secondary text-accent inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold">
          Ne consomme aucune recherche
        </span>
      </PageHeader>

      {feed.length > 0 ? (
        <AdGrid ads={feed} />
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
