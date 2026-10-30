"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Hls from "hls.js";
import { Icon } from "./Icon";
import { useCanDownload } from "./PlanProvider";

type Phase = "loading" | "transcoding" | "verifying" | "ok" | "error";

const isM3u8 = (u: string) => /\.m3u8(\?|$)/i.test(u);
const inlineProxy = (u: string) => `/api/spy/video?inline=1&url=${encodeURIComponent(u)}`;
const downloadHref = (u: string) => `/api/spy/video?url=${encodeURIComponent(u)}`;

const POLL_MS = 2500;
const POLL_MAX = 60; // ~150 s d'optimisation max avant le secours
const SAMPLE_DELAYS = [1500, 3000]; // contrôles d'image noire (ms après "playing")

/** Nombre d'images réellement décodées (0 = piste qui « joue » sans image). */
function decodedFrames(v: HTMLVideoElement): number | null {
  const q = v.getVideoPlaybackQuality?.();
  if (q) return q.totalVideoFrames;
  const w = (v as HTMLVideoElement & { webkitDecodedFrameCount?: number }).webkitDecodedFrameCount;
  return typeof w === "number" ? w : null;
}

/**
 * L'image affichée est-elle noire ? (échantillon 32×32, luminance max).
 * null = impossible à mesurer (source cross-origin) → on s'en remet aux frames.
 */
function frameIsBlack(v: HTMLVideoElement, canvas: HTMLCanvasElement): boolean | null {
  try {
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, 32, 32);
    const d = ctx.getImageData(0, 0, 32, 32).data;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (l > max) max = l;
    }
    return max < 24;
  } catch {
    return null;
  }
}

/**
 * Lecteur vidéo des pubs — grande modale centrée (mobile + desktop).
 *
 * Ordre de lecture (jamais d'écran noir) :
 *  1. Flux HLS transcodé déjà connu (`hlsUrl`) → lecture immédiate (hls.js).
 *  2. Sinon, pour une source vidéo (CDN Meta / archive) : transcodage H.264/HLS
 *     via /api/spy/play (idempotent), le temps d'une première optimisation.
 *  3. Secours ultime : la source brute via le proxy même-origine, avec contrôle
 *     « image noire » renforcé (images décodées + luminance réelle, pas
 *     videoWidth qui reste > 0 sur une piste DASH noire).
 *  4. Échec réel → carte « Ouvrir dans Ad Library » + « Télécharger ».
 * La vidéo reste masquée par un voile tant que l'image n'est pas vérifiée.
 * Fermeture : croix, clic extérieur, touche Échap.
 */
/** Ce qu'une carte transmet au lecteur. */
export type PlayRequest = {
  url: string;
  adId?: string | null;
  hlsUrl?: string | null;
  sourceUrl?: string | null;
  adLibraryUrl?: string;
};

export function VideoLightbox({
  url,
  adId,
  hlsUrl,
  sourceUrl,
  adLibraryUrl,
  onClose,
}: {
  url: string;
  adId?: string | null;
  hlsUrl?: string | null;
  sourceUrl?: string | null;
  adLibraryUrl?: string;
  onClose: () => void;
}) {
  const canDownload = useCanDownload();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelledRef = useRef(false);
  // Étape courante + callbacks du <video> (ref stable vers l'effet courant).
  const stageRef = useRef<"hls" | "raw">("hls");
  const handlersRef = useRef<{ onError: () => void; onPlaying: () => void }>({
    onError: () => {},
    onPlaying: () => {},
  });

  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState("Chargement de la vidéo…");
  const [portrait, setPortrait] = useState<boolean | null>(null);

  // Source brute (Meta) : pour le secours, le transcodage et le téléchargement.
  const raw = sourceUrl || (isM3u8(url) ? null : url);

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

    const later = (fn: () => void, ms: number) => {
      timersRef.current.push(setTimeout(fn, ms));
    };
    const clearTimers = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    function fail(msg = "Cette vidéo ne peut pas être lue ici.") {
      if (cancelledRef.current) return;
      clearTimers();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      setStatus(msg);
      setPhase("error");
    }

    function attach(src: string, stage: "hls" | "raw") {
      if (cancelledRef.current) return;
      const video = videoRef.current;
      if (!video) return;
      stageRef.current = stage;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      setPhase("verifying");
      setStatus(stage === "hls" ? "Chargement de la vidéo…" : "Lecture de la source…");

      if (isM3u8(src)) {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, d) => {
            if (d.fatal) handlersRef.current.onError();
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src; // Safari : HLS natif
        } else {
          return fail("Ce navigateur ne peut pas lire ce format.");
        }
      } else {
        video.src = src;
      }
      video.play().catch(() => {
        /* autoplay bloqué : les contrôles restent dispo */
      });
    }

    // Dernier recours : source brute via le proxy même-origine (image mesurable).
    function playRaw() {
      if (cancelledRef.current) return;
      clearTimers();
      if (!raw) return fail();
      attach(inlineProxy(raw), "raw");
    }

    // Transcodage H.264/HLS (idempotent côté serveur), avec attente polie.
    let transcodeTried = false;
    async function transcode() {
      if (cancelledRef.current) return;
      if (!raw) return fail();
      if (transcodeTried) return playRaw();
      transcodeTried = true;
      setPhase("transcoding");
      setStatus("Optimisation de la vidéo…");
      try {
        const q = new URLSearchParams({ url: raw });
        if (adId) q.set("ad", adId);
        const r = await fetch(`/api/spy/play?${q.toString()}`);
        const j = await r.json();
        if (cancelledRef.current) return;
        if (!j?.configured || j.allowed === false || j.failed || !j.guid) return playRaw();
        if (j.ready && j.hls) return attach(j.hls, "hls");

        setStatus("Optimisation de la vidéo… (première lecture, environ 1 min)");
        const guid = j.guid as string;
        let tries = 0;
        const poll = async () => {
          if (cancelledRef.current) return;
          tries++;
          try {
            const pr = await fetch(`/api/spy/play?guid=${encodeURIComponent(guid)}`);
            const pj = await pr.json();
            if (cancelledRef.current) return;
            if (pj.ready && pj.hls) return attach(pj.hls, "hls");
            if (pj.failed) return playRaw();
          } catch {
            /* on retentera */
          }
          if (tries >= POLL_MAX) return playRaw();
          later(poll, POLL_MS);
        };
        later(poll, POLL_MS);
      } catch {
        playRaw();
      }
    }

    let hlsTried = false;
    function start() {
      if (hlsUrl && !hlsTried) {
        hlsTried = true;
        return attach(hlsUrl, "hls");
      }
      if (isM3u8(url) && !raw && !hlsTried) {
        hlsTried = true;
        return attach(url, "hls");
      }
      return transcode();
    }

    handlersRef.current = {
      // Erreur de lecture : HLS connu KO → transcodage ; sinon secours / échec.
      onError: () => {
        if (cancelledRef.current) return;
        clearTimers();
        if (stageRef.current === "hls") {
          if (hlsTried && raw) return transcode();
          return playRaw();
        }
        fail();
      },
      // La lecture démarre : on vérifie qu'il y a VRAIMENT une image.
      onPlaying: () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || cancelledRef.current) return;
        if (video.videoWidth > 0) setPortrait(video.videoHeight > video.videoWidth);
        const stage = stageRef.current;
        const blacks: boolean[] = [];
        SAMPLE_DELAYS.forEach((ms, i) => {
          later(() => {
            if (cancelledRef.current || stageRef.current !== stage) return;
            const frames = decodedFrames(video);
            const noFrames = frames !== null && frames === 0 && video.currentTime > 0.5;
            const black = frameIsBlack(video, canvas);
            blacks.push(noFrames || black === true);
            // 1er contrôle OK (images décodées, pas noire) → on révèle.
            if (i === 0 && !noFrames && black !== true) setPhase("ok");
            if (i === SAMPLE_DELAYS.length - 1) {
              if (blacks.every(Boolean)) {
                // Piste sans image : HLS → transcodage/secours ; brut → échec.
                if (stage === "hls") return playRaw();
                return fail("Meta ne fournit plus que le son de cette vidéo (lien expiré). Ouvre-la dans Ad Library.");
              }
              setPhase("ok");
            }
          }, ms);
        });
      },
    };

    start();
    return () => {
      cancelledRef.current = true;
      clearTimers();
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [url, hlsUrl, raw, adId]);

  const showVeil = phase !== "ok";
  // Grand lecteur : portrait borné par la hauteur, paysage large.
  const maxWidth =
    portrait === false ? "min(94vw, 1100px)" : "min(92vw, calc(88vh * 9 / 16))";

  // Rendu dans <body> (portail) : un parent animé (transform/filter) ferait de
  // « fixed » une position relative à lui → lecteur décalé hors de l'écran,
  // seul le son restait. Ici, toujours centré sur toute la fenêtre.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Lecture de la vidéo"
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full" style={{ maxWidth: phase === "error" ? "min(92vw, 28rem)" : maxWidth }}>
        <button
          onClick={onClose}
          className="bg-surface text-fg shadow-raised absolute -right-2 -top-2 z-20 grid h-10 w-10 place-items-center rounded-full sm:-right-4 sm:-top-4"
          aria-label="Fermer"
        >
          <Icon name="x" size={18} />
        </button>

        {phase === "error" ? (
          <div className="bg-surface rounded-xl p-6 text-center">
            <span className="bg-danger-bg text-danger mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl">
              <Icon name="eyeOff" size={24} />
            </span>
            <p className="text-fg font-semibold">Lecture impossible</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-sm">{status}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {adLibraryUrl && (
                <a
                  href={adLibraryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-accent text-accent-on inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold"
                >
                  <Icon name="external" size={16} /> Ouvrir dans Ad Library
                </a>
              )}
              {raw &&
                (canDownload ? (
                  <a
                    href={downloadHref(raw)}
                    className="border-border text-fg inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-semibold"
                  >
                    <Icon name="download" size={16} /> Télécharger
                  </a>
                ) : (
                  <Link
                    href="/offres"
                    className="bg-input text-muted-foreground inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold"
                  >
                    <Icon name="lock" size={16} /> Télécharger (offre Starter)
                  </Link>
                ))}
            </div>
          </div>
        ) : (
          <div className="shadow-raised relative overflow-hidden rounded-xl bg-black">
            {showVeil && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-black">
                <div className="flex flex-col items-center gap-3 px-6 text-center text-white/90">
                  <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span className="text-sm">{status}</span>
                </div>
              </div>
            )}
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onPlaying={() => handlersRef.current.onPlaying()}
              onLoadedMetadata={() => {
                const v = videoRef.current;
                if (v && v.videoWidth > 0) setPortrait(v.videoHeight > v.videoWidth);
              }}
              onError={() => handlersRef.current.onError()}
              className="mx-auto block max-h-[88vh] w-full object-contain"
              style={{ aspectRatio: portrait === null ? "9 / 16" : undefined }}
            />
            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          </div>
        )}

        {phase === "ok" && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {canDownload && raw && (
              <a
                href={downloadHref(raw)}
                className="bg-surface/90 text-fg inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold backdrop-blur"
              >
                <Icon name="download" size={15} /> Télécharger
              </a>
            )}
            {adLibraryUrl && (
              <a
                href={adLibraryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface/90 text-fg inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold backdrop-blur"
              >
                <Icon name="external" size={15} /> Ad Library
              </a>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
