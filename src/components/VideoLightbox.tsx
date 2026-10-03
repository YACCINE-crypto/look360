"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Hls from "hls.js";
import { Icon } from "./Icon";
import { useCanDownload } from "./PlanProvider";

type Phase = "loading" | "ok" | "transcoding" | "error";

const isM3u8 = (u: string) => /\.m3u8(\?|$)/i.test(u);
const inlineProxy = (u: string) => `/api/spy/video?inline=1&url=${encodeURIComponent(u)}`;
const downloadHref = (u: string) => `/api/spy/video?url=${encodeURIComponent(u)}`;

/**
 * Lecteur vidéo des pubs — lightbox contenue (mobile + desktop).
 * - Taille bornée selon l'orientation (portrait ≤ 420px, paysage ≤ 720px, 85vh),
 *   vidéo en object-contain (letterbox propre, jamais d'étirement).
 * - Fermeture : clic extérieur + touche Échap + bouton visible.
 * - Lecture instantanée : on joue D'ABORD la source directe (proxy même-origine
 *   avec Range). Si elle échoue ou reste noire (codec non décodé), on bascule
 *   AUTOMATIQUEMENT sur un flux transcodé (web-safe) le temps de l'optimisation.
 *   En dernier recours → message + Télécharger / Ad Library.
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
  const rescuedRef = useRef(false); // une seule tentative de transcodage
  const blackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  // Les callbacks d'événements du <video> pointent vers rescue/onFail définis
  // dans l'effet (ref stable, mise à jour à chaque (re)montage de la source).
  const handlersRef = useRef<{ rescue: () => void; onFail: (m?: string) => void }>({
    rescue: () => {},
    onFail: () => {},
  });

  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState("Chargement de la vidéo…");
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

  useEffect(() => {
    cancelledRef.current = false;

    function clearTimers() {
      if (blackTimerRef.current) clearTimeout(blackTimerRef.current);
      if (pollRef.current) clearTimeout(pollRef.current);
      blackTimerRef.current = null;
      pollRef.current = null;
    }

    function attach(src: string) {
      if (cancelledRef.current) return;
      const video = videoRef.current;
      if (!video) return;
      // Nettoie une éventuelle instance HLS précédente.
      hlsRef.current?.destroy();
      hlsRef.current = null;

      if (isM3u8(src)) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, d) => {
            if (d.fatal) onFail();
          });
        } else {
          onFail("Ce navigateur ne peut pas lire ce format.");
          return;
        }
      } else {
        video.src = src;
      }
      video.play().catch(() => {
        /* autoplay bloqué : les contrôles restent dispo */
      });
    }

    // 1) Lecture directe immédiate (proxy même-origine si mp4, HLS direct sinon).
    function playDirect() {
      setPhase("loading");
      setStatus("Chargement de la vidéo…");
      attach(isM3u8(url) ? url : inlineProxy(url));
    }

    // 2) Secours : transcodage web-safe (une seule fois). Déclenché si la source
    //    directe échoue ou reste noire.
    async function rescue() {
      if (cancelledRef.current || rescuedRef.current) return onFail();
      rescuedRef.current = true;
      clearTimers();
      setPhase("transcoding");
      setStatus("Optimisation de la vidéo…");
      try {
        const r = await fetch(`/api/spy/play?url=${encodeURIComponent(url)}`);
        const j = await r.json();
        if (cancelledRef.current) return;
        if (!j?.configured) return onFail(); // pas de service de transcodage
        if (j.ready && j.hls) return attach(j.hls);
        if (j.error) return onFail();

        const guid = j.guid as string;
        let tries = 0;
        const poll = async () => {
          if (cancelledRef.current) return;
          tries++;
          try {
            const pr = await fetch(`/api/spy/play?guid=${encodeURIComponent(guid)}`);
            const pj = await pr.json();
            if (cancelledRef.current) return;
            if (pj.ready && pj.hls) return attach(pj.hls);
            if (pj.error) return onFail();
          } catch {
            /* on retentera */
          }
          if (tries >= 40) return onFail(); // ~100s max d'optimisation
          pollRef.current = setTimeout(poll, 2500);
        };
        pollRef.current = setTimeout(poll, 2500);
      } catch {
        onFail();
      }
    }

    function onFail(msg = "Cette vidéo ne peut pas être lue ici.") {
      if (cancelledRef.current) return;
      clearTimers();
      setStatus(msg);
      setPhase("error");
    }

    // expose les handlers aux events du <video> via les refs du composant
    handlersRef.current = { rescue, onFail };

    playDirect();
    return () => {
      cancelledRef.current = true;
      clearTimers();
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Première image décodée : la vidéo s'affiche vraiment.
  function onPlaying() {
    const video = videoRef.current;
    if (!video) return;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (blackTimerRef.current) clearTimeout(blackTimerRef.current);
      blackTimerRef.current = null;
      setPortrait(video.videoHeight > video.videoWidth);
      setPhase("ok");
    } else if (!rescuedRef.current) {
      // La piste joue mais aucune image (codec non décodé) → secours transcodage.
      if (blackTimerRef.current) clearTimeout(blackTimerRef.current);
      blackTimerRef.current = setTimeout(() => {
        const v = videoRef.current;
        if (v && (v.videoWidth === 0 || v.videoHeight === 0)) handlersRef.current.rescue();
      }, 1400);
    }
  }
  function onLoadedMeta() {
    const video = videoRef.current;
    if (video && video.videoWidth > 0) setPortrait(video.videoHeight > video.videoWidth);
  }

  // Largeur max selon l'orientation (portrait ≤ 420, paysage ≤ 720, inconnu 480).
  const maxW = portrait === null ? 480 : portrait ? 420 : 720;
  const showSpinner = phase === "loading" || phase === "transcoding";

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
          className="bg-surface text-fg absolute -right-2 -top-2 z-20 grid h-9 w-9 place-items-center rounded-full shadow-lg sm:-right-3 sm:-top-3"
          aria-label="Fermer"
        >
          <Icon name="x" size={18} />
        </button>

        {phase === "error" ? (
          <div className="bg-surface rounded-2xl p-6 text-center">
            <span className="bg-danger-bg text-danger mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl">
              <Icon name="eyeOff" size={24} />
            </span>
            <p className="text-fg font-semibold">Lecture impossible</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-sm">{status}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {canDownload ? (
                <a
                  href={downloadHref(url)}
                  className="bg-accent text-accent-on inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold"
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
                  className="border-border text-fg inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-semibold"
                >
                  <Icon name="external" size={16} /> Ouvrir dans Ad Library
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl">
            {showSpinner && (
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
              onError={() => handlersRef.current.rescue()}
              className="mx-auto block max-h-[85vh] w-full object-contain"
              style={{ aspectRatio: portrait === null ? "9 / 16" : undefined }}
            />
          </div>
        )}

        {phase === "ok" && canDownload && (
          <a
            href={downloadHref(url)}
            className="bg-surface/90 text-fg mt-3 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold backdrop-blur"
          >
            <Icon name="download" size={15} /> Télécharger
          </a>
        )}
      </div>
    </div>
  );
}
