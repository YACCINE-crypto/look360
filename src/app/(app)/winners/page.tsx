import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { EmptyPreview } from "@/components/dataviz";
import { Icon } from "@/components/Icon";
import { AdGrid } from "@/components/AdGrid";
import { FeatureLock } from "@/components/FeatureLock";
import { getSubscription } from "@/lib/credits";
import { planConfig } from "@/lib/billing";
import { WinnerConfigForm, type WinnerConfig } from "./WinnerConfigForm";
import { lancerWinnerMaintenant } from "./actions";
import { WINNER_DEFAULTS, type SpyAd } from "@/lib/spy";

export const dynamic = "force-dynamic";

export default async function WinnersPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Winner Agent = réservé aux offres qui l'incluent (Pro et plus).
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const sub = userId ? await getSubscription(userId) : null;
  if (!planConfig(sub?.plan).winnerEnabled) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Winners du jour"
          subtitle="Les meilleures pubs repérées automatiquement selon tes critères."
        />
        <FeatureLock
          title="Winner Agent automatique"
          minPlan="Pro"
          description="L'agent scanne le marché chaque jour et te sort les meilleures pubs selon tes mots-clés et tes pays. Disponible avec les offres Pro et Business."
        />
      </div>
    );
  }

  const [{ data: cfgRow }, { data: winners }] = await Promise.all([
    supabase.from("winner_agent_config").select("*").maybeSingle(),
    supabase
      .from("winner_daily")
      .select("*")
      .eq("day", today)
      .order("score", { ascending: false }),
  ]);

  const config: WinnerConfig = cfgRow
    ? {
        active: cfgRow.active,
        keywords: cfgRow.keywords,
        countries: cfgRow.countries,
        anciennete_min: cfgRow.anciennete_min,
        reach_min: cfgRow.reach_min,
        score_min: cfgRow.score_min,
        results_max: cfgRow.results_max,
      }
    : { active: true, ...WINNER_DEFAULTS };

  const ads = (winners ?? []).map((w) => w.payload as unknown as SpyAd);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Winners du jour"
        subtitle="Les meilleures pubs repérées automatiquement selon tes critères."
      >
        <form action={lancerWinnerMaintenant}>
          <button
            type="submit"
            className="bg-primary text-primary-foreground inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Icon name="trophy" size={16} /> Lancer maintenant
          </button>
        </form>
      </PageHeader>

      <WinnerConfigForm config={config} />

      {ads.length === 0 ? (
        <EmptyPreview
          icon="trophy"
          title="Aucun winner aujourd'hui pour l'instant"
          description="L'agent tourne chaque jour. Ajuste tes critères ci-dessus puis lance un repérage, ou explore le Spy en attendant."
          ctaHref="/spy"
          ctaLabel="Explorer le Spy"
          variant="cards"
        />
      ) : (
        <>
          <p className="text-muted-foreground text-sm">{ads.length} winner(s) aujourd&apos;hui</p>
          <AdGrid ads={ads} />
        </>
      )}
    </div>
  );
}
