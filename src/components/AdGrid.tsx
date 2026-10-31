"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SpyCard } from "@/app/(app)/spy/SpyClient";
import { VideoLightbox, type PlayRequest } from "@/components/VideoLightbox";
import type { SpyAd } from "@/lib/spy";

/**
 * Grille de cartes pub réutilisable (Winners du jour, Top Trend).
 * "Analyser" mène au Spy filtré sur l'annonceur ; lecture vidéo en modale.
 */
export function AdGrid({ ads, ranked = false }: { ads: SpyAd[]; ranked?: boolean }) {
  const router = useRouter();
  const [playing, setPlaying] = useState<PlayRequest | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ads.map((ad, i) => (
          <div key={ad.ad_archive_id || i}>
            <SpyCard
              ad={ad}
              rank={ranked ? i + 1 : undefined}
              onAnalyze={(a) =>
                router.push(
                  `/analyse/${encodeURIComponent(a.page_id ?? "")}?country=${encodeURIComponent(a.country ?? "FR")}&name=${encodeURIComponent(a.page_name ?? "")}`,
                )
              }
              onPlay={setPlaying}
            />
          </div>
        ))}
      </div>
      {playing && (
        <VideoLightbox
          url={playing.url}
          adLibraryUrl={playing.adLibraryUrl}
          adId={playing.adId}
          hlsUrl={playing.hlsUrl}
          sourceUrl={playing.sourceUrl}
          pageName={playing.pageName}
          adText={playing.adText}
          ctaText={playing.ctaText}
          landingDomain={playing.landingDomain}
          onClose={() => setPlaying(null)}
        />
      )}
    </>
  );
}
