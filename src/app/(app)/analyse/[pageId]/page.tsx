import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { getSubscription } from "@/lib/credits";
import { planLimits } from "@/lib/billing";
import { cleanField } from "@/lib/spy";
import { AnalyseClient } from "./AnalyseClient";

export const dynamic = "force-dynamic";

/**
 * Analyse d'un annonceur : s'ouvre directement (plus d'écran de confirmation).
 * Les pubs sont chargées progressivement côté client (/api/analyse/stream),
 * ce qui évite la coupure à 60 s du rendu serveur. Ré-ouvrir une analyse
 * récente est instantané et ne consomme rien (cache 12 h).
 */
export default async function AnalysePage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ country?: string; name?: string }>;
}) {
  const { pageId } = await params;
  const sp = await searchParams;
  const country = (sp.country || "FR").toUpperCase();
  const name = cleanField(sp.name) ?? "";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  const sub = userId ? await getSubscription(userId) : null;

  if (planLimits(sub?.plan ?? "free").monthlySearches === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8">
        <Link href="/spy" className="text-muted-foreground hover:text-fg flex items-center gap-1 text-sm">
          <Icon name="chevronRight" size={14} className="rotate-180" />
          Spy Facebook
        </Link>
        <Card className="space-y-4 p-6">
          <h1 className="text-lg font-bold">Analyser {name || "cet annonceur"}</h1>
          <p className="text-sm">L&apos;analyse d&apos;un annonceur est réservée aux offres payantes.</p>
          <Link
            href="/offres"
            className="bg-accent text-accent-on inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold"
          >
            Voir les offres
          </Link>
        </Card>
      </div>
    );
  }

  // Ouvrir la fiche = "j'ai vu" → on remet le badge "nouvelle pub" à zéro.
  if (userId) {
    await supabase
      .from("competitors_watch")
      .update({ new_ads_count: 0 })
      .eq("user_id", userId)
      .eq("page_id", pageId);
  }

  return <AnalyseClient pageId={pageId} country={country} name={name} />;
}
