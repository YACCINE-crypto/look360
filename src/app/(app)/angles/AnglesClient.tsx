"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { emotionLabel } from "@/lib/produits";
import { scoreMeta } from "@/lib/score";
import { margeColorClass } from "@/lib/testing";

export type AngleRow = {
  id: string;
  angle: string;
  nom: string;
  emotion: string | null;
  marche: string;
  score: number;
  marge: number | null;
  verdictLabel: string | null;
  verdictBadge: string | null;
};

export type EmotionCount = { code: string; label: string; count: number };

export function AnglesClient({
  angles,
  emotionCounts,
}: {
  angles: AngleRow[];
  emotionCounts: EmotionCount[];
}) {
  const [emotion, setEmotion] = useState<string>("");

  const filtered = useMemo(
    () => (emotion ? angles.filter((a) => a.emotion === emotion) : angles),
    [angles, emotion],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bibliothèque d'angles"
        subtitle="Les angles marketing de tes produits, triés par score — réutilise ce qui marche."
      />

      {/* Filtres par émotion */}
      {emotionCounts.length > 0 && (
        <div className="no-scrollbar -mx-1 flex touch-pan-x flex-nowrap gap-1.5 overflow-x-auto px-1">
          <button
            type="button"
            onClick={() => setEmotion("")}
            className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition-colors ${
              emotion === ""
                ? "bg-primary text-primary-foreground"
                : "bg-input text-muted-foreground hover:text-foreground"
            }`}
          >
            Toutes ({angles.length})
          </button>
          {emotionCounts.map((e) => (
            <button
              key={e.code}
              type="button"
              onClick={() => setEmotion(e.code)}
              className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition-colors ${
                emotion === e.code
                  ? "bg-primary text-primary-foreground"
                  : "bg-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {e.label} ({e.count})
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Aucun angle renseigné pour l&apos;instant. Ajoute un{" "}
            <span className="font-medium">angle marketing</span> à tes produits
            pour construire ta bibliothèque.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((a) => (
            <article
              key={a.id}
              className="border-border bg-surface shadow-card flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-foreground flex-1 text-sm leading-relaxed">
                  <Icon
                    name="tag"
                    size={14}
                    className="text-primary mr-1.5 inline-block align-[-2px]"
                  />
                  {a.angle}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreMeta(a.score).badge}`}
                  title="Score du produit"
                >
                  {a.score}
                </span>
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-foreground font-medium">{a.nom}</span>
                <span>· {a.marche}</span>
                {a.emotion && (
                  <span className="bg-chip-idee text-chip-idee-fg rounded px-1.5 py-0.5 font-medium">
                    {emotionLabel(a.emotion)}
                  </span>
                )}
                {a.marge !== null && (
                  <span className={`font-medium ${margeColorClass(a.marge)}`}>
                    {a.marge.toFixed(0)}% marge
                  </span>
                )}
                {a.verdictLabel && a.verdictBadge && (
                  <span className={`rounded-full px-2 py-0.5 font-medium ${a.verdictBadge}`}>
                    {a.verdictLabel}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
