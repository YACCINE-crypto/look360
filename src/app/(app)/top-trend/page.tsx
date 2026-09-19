import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { AdGrid } from "@/components/AdGrid";
import { TopTrendFilters } from "./TopTrendFilters";
import { SPY_COUNTRIES, type SpyAd, type SpyRegion } from "@/lib/spy";

export const dynamic = "force-dynamic";

const REGION_OF = new Map<string, SpyRegion>(SPY_COUNTRIES.map((c) => [c.code, c.region]));

export default async function TopTrendPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; days?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const region = sp.region === "africa" || sp.region === "europe" ? sp.region : "all";
  const days = sp.days === "7" ? 7 : 30;
  const q = (sp.q || "").toLowerCase().trim();

  // Classement recalculé à partir des recherches déjà scrapées (pas de re-scraping).
  const admin = createAdminClient();
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data: rows } = await admin
    .from("spy_searches")
    .select("results")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);

  const map = new Map<string, SpyAd>();
  for (const row of rows ?? []) {
    const list = (row.results as unknown as SpyAd[]) ?? [];
    for (const ad of list) {
      if (!ad?.ad_archive_id) continue;
      if (region !== "all" && REGION_OF.get(ad.country ?? "") !== region) continue;
      if (q) {
        const hay = `${ad.page_name ?? ""} ${ad.ad_text ?? ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const prev = map.get(ad.ad_archive_id);
      if (!prev || ad.score > prev.score) map.set(ad.ad_archive_id, ad);
    }
  }
  const ads = [...map.values()].sort((a, b) => b.score - a.score).slice(0, 50);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Top Trend"
        subtitle="Classement des meilleures pubs repérées — à partir des recherches déjà faites."
      />
      <Suspense fallback={null}>
        <TopTrendFilters />
      </Suspense>

      {ads.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <span className="bg-secondary text-primary mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full">
            <Icon name="trending" size={24} />
          </span>
          <p className="font-medium">Pas encore de tendances</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Le classement se remplit avec les recherches Spy et les runs du Winner
            Agent. Lance quelques recherches pour l&apos;alimenter.
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">Top {ads.length} · {days} derniers jours</p>
          <AdGrid ads={ads} ranked />
        </>
      )}
    </div>
  );
}
