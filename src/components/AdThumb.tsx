"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Miniature de pub : copie CDN d'abord, puis lien Meta. Si l'image ne charge
 * pas (lien Meta expiré), on affiche un repli propre au lieu d'une image cassée.
 */
export function AdThumb({ cdn, src, video = false }: { cdn?: string | null; src?: string | null; video?: boolean }) {
  const list = [cdn, src].filter((u): u is string => Boolean(u));
  const [i, setI] = useState(0);
  const url = list[i];
  if (!url) {
    return (
      <span className="text-muted-foreground grid h-full w-full place-items-center" title="Aperçu expiré chez Meta">
        <Icon name={video ? "play" : "image"} size={18} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={url} src={url} alt="" loading="lazy" onError={() => setI((n) => n + 1)} className="h-full w-full object-cover" />
  );
}
