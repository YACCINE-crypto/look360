import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getFeed } from "@/lib/feed";
import { PageHeader } from "@/components/ui";
import { FeedClient } from "./FeedClient";
import { EmptyState } from "@/components/EmptyState";
import { Sparkles } from "lucide-react";
import { UnlockMore } from "@/components/shops/ShopCards";
import { currentAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * Recherche = Feed du jour : pubs gagnantes repérées chaque matin, communes à
 * tous. Offre gratuite : le SERVEUR ne lit et n'envoie que les N premières
 * (plan_limits.feed_limit = 20) ; le reste est compté, jamais transmis.
 */
export default async function RecherchePage() {
  const admin = createAdminClient();
  const { feedLimit, userId } = await currentAccess();
  // Niches / pays choisis à l'onboarding : mis en avant en premier (si la
  // colonne n'existe pas encore, feed classique).
  const { data: prefs } = userId
    ? ((await (await createClient())
        .from("profiles")
        .select("pref_niches, pref_markets" as "nom")
        .eq("id", userId)
        .maybeSingle()) as unknown as { data: { pref_niches: string[]; pref_markets: string[] } | null })
    : { data: null };
  const [visible, { count }] = await Promise.all([
    getFeed(admin, {
      limit: feedLimit ?? 60,
      prefer: prefs ? { niches: prefs.pref_niches ?? [], markets: prefs.pref_markets ?? [] } : undefined,
    }),
    admin.from("feed_ads").select("id", { count: "exact", head: true }),
  ]);
  const total = count ?? visible.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feed du jour"
        subtitle={`${total} pubs actives repérées ce matin, en Afrique et en Europe, triées par score.`}
      >
        <span className="bg-secondary text-accent inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold">
          Ne consomme aucune recherche
        </span>
      </PageHeader>

      {visible.length > 0 ? (
        <>
          <FeedClient ads={visible} />
          {feedLimit != null && total > visible.length && (
            <UnlockMore what="winners" total={total} shown={visible.length} />
          )}
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
