"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { VideoLightbox } from "./VideoLightbox";

/**
 * Bouton « Regarder » qui ouvre le lecteur intégré (flux transcodé d'abord,
 * source Meta en secours) au lieu d'ouvrir un lien brut dans un onglet.
 */
export function WatchVideoButton({
  url,
  sourceUrl,
  adId,
  adLibraryUrl,
  className,
}: {
  url: string;
  sourceUrl?: string | null;
  adId?: string | null;
  adLibraryUrl?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const isHls = /\.m3u8(\?|$)/i.test(url);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Icon name="play" size={12} /> Regarder
      </button>
      {open && (
        <VideoLightbox
          url={url}
          hlsUrl={isHls ? url : null}
          sourceUrl={sourceUrl ?? (isHls ? null : url)}
          adId={adId}
          adLibraryUrl={adLibraryUrl ?? undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
