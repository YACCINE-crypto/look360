import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchSpyWithCache } from "@/lib/spyCache";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { AdGrid } from "@/components/AdGrid";
import { AdActivityChart } from "./AdActivityChart";
import { SuivreButton } from "./SuivreButton";
import { ajouterAuxProduits } from "../../spy/actions";
import { activityByMonth, countryLabel, type SpyAd } from "@/lib/spy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const nf = new Intl.NumberFormat("fr-FR");

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.length <= 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function mostFrequent(arr: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of arr) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

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

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;

  let ads: SpyAd[] = [];
  let failed = false;
  try {
    const res = await searchSpyWithCache(
      { q: "", country, pageId, statut: "active", tri: "anciennete", limit: 100 },
      userId,
    );
    ads = res.ads;
  } catch {
    failed = true;
  }

  const pageName = sp.name || ads[0]?.page_name || "Annonceur";
  const likes = ads.find((a) => a.page_like_count != null)?.page_like_count ?? null;
  const domaine = mostFrequent(ads.map((a) => a.landing_domain));
  const platforms = Array.from(new Set(ads.flatMap((a) => a.platforms)));
  const firstDate = ads.map((a) => a.start_date).filter(Boolean).sort()[0] ?? null;
  const chart = activityByMonth(ads, 12);
  const top = [...ads].sort((a, b) => b.score - a.score)[0] ?? null;

  return (
    <div className="space-y-5">
      <Link
        href="/spy"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
      >
        <Icon name="chevronRight" size={14} className="rotate-180" />
        Spy Facebook
      </Link>

      {/* En-tête concurrent */}
      <div className="border-border bg-surface shadow-card flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{pageName}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {domaine && (
              <span className="flex items-center gap-1">
                <Icon name="external" size={13} /> {domaine}
              </span>
            )}
            {likes != null && (
              <span className="flex items-center gap-1">
                <Icon name="users" size={13} /> {nf.format(likes)} likes
              </span>
            )}
            <span className="flex items-center gap-1">
              <Icon name="today" size={13} /> 1ʳᵉ pub vue : {formatDate(firstDate)}
            </span>
            <span>{countryLabel(country)}</span>
          </div>
          {platforms.length > 0 && (
            <p className="text-muted-foreground mt-1 text-xs">{platforms.join(" · ")}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <SuivreButton pageId={pageId} pageName={pageName} domaine={domaine} country={country} />
          {top && (
            <form action={ajouterAuxProduits}>
              <input type="hidden" name="nom" value={pageName} />
              <input type="hidden" name="image_url" value={top.thumbnail_url ?? top.media_url ?? ""} />
              <input type="hidden" name="landing_url" value={top.landing_url ?? ""} />
              <input type="hidden" name="ad_library_url" value={top.ad_library_url} />
              <input type="hidden" name="ad_text" value={top.ad_text ?? ""} />
              <input type="hidden" name="marche" value={top.country ?? ""} />
              <button
                type="submit"
                className="bg-primary text-primary-foreground inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                <Icon name="plus" size={16} /> Ajouter à mes produits
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="flex flex-col gap-1 px-4 py-3">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Pubs actives
          </span>
          <span className="text-primary text-2xl font-bold tabular-nums">{ads.length}</span>
          <span className="text-muted-foreground text-xs">créatives en diffusion</span>
        </Card>
        {/* Emplacements "à venir" — pas de données publiques dispo, aucun chiffre inventé */}
        {["Trafic boutique", "Followers réseaux", "Avis Trustpilot"].map((label) => (
          <Card key={label} className="flex flex-col gap-1 px-4 py-3 opacity-70">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {label}
            </span>
            <span className="text-muted-foreground text-2xl font-bold">—</span>
            <span className="text-muted-foreground text-xs">à venir</span>
          </Card>
        ))}
      </div>

      {/* Graphe activité */}
      <Card className="p-5">
        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
          Activité publicitaire (pubs lancées / mois)
        </p>
        <AdActivityChart data={chart} />
      </Card>

      {/* Créatives */}
      {failed ? (
        <div className="bg-danger-bg text-danger rounded-xl p-4 text-sm">
          Impossible de récupérer les pubs de cette page pour le moment. Réessaie
          dans un instant.
        </div>
      ) : ads.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Aucune pub active trouvée pour cette page (ou throttling Meta temporaire).
            Réessaie un peu plus tard.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold">Créatives actives ({ads.length})</h2>
          <AdGrid ads={ads} />
        </div>
      )}
    </div>
  );
}
