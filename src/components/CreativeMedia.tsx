"use client";

import { Icon } from "./Icon";

/* eslint-disable @next/next/no-img-element */

/**
 * Cadre média unique pour TOUTES les créatives (Spy, Winners, Top Trend,
 * Sauvegardés, Analyse concurrent…). Format fixe (carré 1:1 par défaut),
 * object-cover + centrage → jamais de déformation ni de cartes désalignées.
 * Vidéo : icône play centrée au-dessus de la miniature (cliquable si onPlay).
 * `children` = badges superposés (score, statut, marque-page…).
 */
export function CreativeMedia({
  image,
  alt = "",
  isVideo = false,
  playUrl,
  onPlay,
  ratio = "square",
  children,
}: {
  image: string | null;
  alt?: string;
  isVideo?: boolean;
  playUrl?: string | null;
  onPlay?: (url: string) => void;
  ratio?: "square" | "portrait";
  children?: React.ReactNode;
}) {
  const aspect = ratio === "portrait" ? "aspect-[4/5]" : "aspect-square";
  const canPlay = isVideo && !!playUrl && !!onPlay;

  return (
    <div className={`bg-input relative w-full overflow-hidden ${aspect}`}>
      {image ? (
        <img src={image} alt={alt} className="h-full w-full object-cover object-center" />
      ) : (
        <div className="text-muted-foreground grid h-full w-full place-items-center">
          <Icon name="image" size={26} />
        </div>
      )}

      {isVideo &&
        (canPlay ? (
          <button
            type="button"
            onClick={() => onPlay!(playUrl!)}
            className="absolute inset-0 grid place-items-center bg-black/10 transition-colors hover:bg-black/25"
            aria-label="Regarder la vidéo"
          >
            <span className="bg-surface/90 text-foreground grid h-12 w-12 place-items-center rounded-full shadow">
              <Icon name="play" size={20} />
            </span>
          </button>
        ) : (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="bg-surface/90 text-foreground grid h-12 w-12 place-items-center rounded-full shadow">
              <Icon name="play" size={20} />
            </span>
          </span>
        ))}

      {children}
    </div>
  );
}
