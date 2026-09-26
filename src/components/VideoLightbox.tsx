"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Hls from "hls.js";
import { Icon } from "./Icon";
import { useCanDownload } from "./PlanProvider";

type Phase = "resolving" | "playing" | "error";

const isM3u8 = (u: string) => /\.m3u8(\?|$)/i.test(u);
const inlineProxy = (u: string) => `/api/spy/video?inline=1&url=${encodeURIComponent(u)}`;
const downloadHref = (u: string) => `/api/spy/video?url=${encodeURIComponent(u)}`;

/**
 * Lecteur vidéo des pubs — lightbox contenue (mobile + desktop).
 * - Taille bornée selon l'orientation (portrait ≤ 420px, paysage ≤ 720px, 85vh),
 *   vidéo en object-contain (letterbox propre, jamais d'étirement).
 * - Fermeture : clic extérieur + touche Échap + bouton visible.
 * - Lecture fiable : flux optimisé (transcodé) si dispo, sinon HLS via hls.js,
 *   sinon proxy même-origine. En cas d'échec → message + Télécharger / Ad Library.
 */
export function VideoLightbox({
  url,
  adLibraryUrl,
  onClose,
}: {
  url: string;
  adLibraryUrl?: string;
  onClose: () => void;
}) {
  const canDownload = useCanDownload();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [phase, setPhase] = useState<Phase>("resolving");
  const [status, setStatus] = useState("Préparation de la vidéo…");
  const [portrait, setPortrait] = useState<boolean | null>(null);

  // Échap + verrouillage du scroll de fond.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Résolution de la source + lecture.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    function fail(msg = "Cette vidéo ne peut pas être lue ici.") {
      if (cancelled) return;
      setStatus(msg);
      setPhase("error");
    }

    function play(src: string) {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;
      setPhase("playing");

      if (isM3u8(src)) {
        // HLS : natif (Safari) sinon hls.js (Chrome/Firefox).
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, d) => {
            if (d.fatal) fail("Le flux vidéo est indisponible.");
          });
        } else {
          fail("Ce navigateur ne peut pas lire ce format.");
          return;
        }
      } else {
        video.src = src;
      }
      video.play().catch(() => {
        /* autoplay bloqué : les contrôles restent dispo */
      });
    }

    async function resolve() {
      // 1) Flux optimisé (transcodé) si le service est configuré.
      try {
        const r = await fetch(`/api/spy/play?url=${encodeURIComponent(url)}`);
        const j = await r.json();
        if (!cancelled && j?.configured) {
          if (j.ready && j.hls) {
            play(j.hls);
            return;
          }
          if (j.error) {
            directPlay();
            return;
          }
          // Transcodage en cours → polling.
          setStatus("Optimisation de la vidéo…");
          const guid = j.guid as string;
          let tries = 0;
          const poll = async () => {
            if (cancelled) return;
            tries++;
            try {
              const pr = await fetch(`/api/spy/play?guid=${encodeURIComponent(guid)}`);
              const pj = await pr.json();
              if (cancelled) return;
              if (pj.ready && pj.hls) return play(pj.hls);
              if (pj.error) return directPlay();
            } catch {
              /* ignore, on retentera */
            }
            if (tries >= 16) return directPlay(); // ~40s → on tente la source directe
            pollTimer = setTimeout(poll, 2500);
          };
          pollTimer = setTimeout(poll, 2500);
          return;
        }
      } catch {
        /* pas configuré / indisponible → lecture directe */
      }
      directPlay();
    }

    function directPlay() {
      if (cancelled) return;
      // HLS direct, sinon proxy même-origine (Range) pour fiabiliser le mp4.
      play(isM3u8(url) ? url : inlineProxy(url));
    }

    resolve();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [url]);

  // Détection « image noire / non décodée » : la piste peut jouer sans image.
  function onPlaying() {
    const video = videoRef.current;
    if (!video) return;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setPortrait(video.videoHeight > video.videoWidth);
    } else {
      // Laisser une chance puis vérifier.
      setTimeout(() => {
        const v = videoRef.current;
        if (v && (v.videoWidth === 0 || v.videoHeight === 0)) {
          setPhase("error");
          setStatus("La vidéo n'a pas pu s'afficher (codec non supporté).");
        }
      }, 1400);
    }
  }
  function onLoadedMeta() {
    const video = videoRef.current;
    if (video && video.videoWidth > 0) setPortrait(video.videoHeight > video.videoWidth);
  }

  // Largeur max selon l'orientation (portrait ≤ 420, paysage ≤ 720, inconnu 480).
  const maxW = portrait === null ? 480 : portrait ? 420 : 720;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full" style={{ maxWidth: maxW }}>
        <button
          onClick={onClose}
          className="bg-surface text-foreground absolute -right-2 -top-2 z-20 grid h-9 w-9 place-items-center rounded-full shadow-lg sm:-right-3 sm:-top-3"
          aria-label="Fermer"
        >
          <Icon name="x" size={18} />
        </button>

        {phase === "error" ? (
          <div className="bg-surface rounded-2xl p-6 text-center">
            <span className="bg-danger-bg text-danger mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl">
              <Icon name="eyeOff" size={24} />
            </span>
            <p className="text-foreground font-semibold">Lecture impossible</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-sm">{status}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {canDownload ? (
                <a
                  href={downloadHref(url)}
                  className="bg-primary text-primary-foreground inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold"
                >
                  <Icon name="download" size={16} /> Télécharger la vidéo
                </a>
              ) : (
                <Link
                  href="/offres"
                  className="bg-input text-muted-foreground inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold"
                >
                  <Icon name="lock" size={16} /> Télécharger (offre Starter)
                </Link>
              )}
              {adLibraryUrl && (
                <a
                  href={adLibraryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border text-foreground inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-semibold"
                >
                  <Icon name="external" size={16} /> Ouvrir dans Ad Library
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl">
            {phase === "resolving" && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                <div className="flex flex-col items-center gap-2 text-white/90">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span className="text-xs">{status}</span>
                </div>
              </div>
            )}
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onPlaying={onPlaying}
              onLoadedMetadata={onLoadedMeta}
              onError={() => {
                setPhase("error");
                setStatus("La source vidéo est indisponible ou dans un format non lisible.");
              }}
              className="mx-auto block max-h-[85vh] w-full object-contain"
              style={{ aspectRatio: portrait === null ? "9 / 16" : undefined }}
            />
          </div>
        )}

        {phase === "playing" && canDownload && (
          <a
            href={downloadHref(url)}
            className="bg-surface/90 text-foreground mt-3 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold backdrop-blur"
          >
            <Icon name="download" size={15} /> Télécharger
          </a>
        )}
      </div>
    </div>
  );
}
