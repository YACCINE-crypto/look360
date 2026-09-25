"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SpyCard, VideoModal } from "@/app/(app)/spy/SpyClient";
import type { SpyAd } from "@/lib/spy";

const MEDAL = ["🥇", "🥈", "🥉"];
function rankClass(i: number): string {
  if (i === 0) return "bg-amber-100 text-amber-700";
  if (i === 1) return "bg-slate-200 text-slate-700";
  if (i === 2) return "bg-orange-100 text-orange-700";
  return "bg-primary text-primary-foreground";
}

/**
 * Grille de cartes pub réutilisable (Winners du jour, Top Trend).
 * "Analyser" mène au Spy filtré sur l'annonceur ; lecture vidéo en modale.
 */
export function AdGrid({ ads, ranked = false }: { ads: SpyAd[]; ranked?: boolean }) {
  const router = useRouter();
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ads.map((ad, i) => (
          <div key={ad.ad_archive_id || i} className="relative">
            {ranked && (
              <span
                className={`absolute -left-2 -top-2 z-30 grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold shadow-md ring-2 ring-surface ${rankClass(i)}`}
                title={`Classement #${i + 1}`}
              >
                {i < 3 ? MEDAL[i] : i + 1}
              </span>
            )}
            <SpyCard
              ad={ad}
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
      {playing && <VideoModal url={playing} onClose={() => setPlaying(null)} />}
    </>
  );
}
