import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Résolveur de flux vidéo optimisé (transcodage H.264 web-safe côté serveur).
 * But : certaines vidéos sources (CDN Meta) ont un codec que le navigateur ne
 * sait pas afficher (image noire, son seul). On les fait retranscoder par le
 * service de streaming (config via variables d'environnement) puis on renvoie
 * une URL HLS qui joue partout.
 *
 * - GET ?url=<source>  → crée/retrouve la vidéo transcodée, renvoie {hls,status}
 * - GET ?guid=<id>     → statut de transcodage (polling client)
 *
 * Si le service n'est pas configuré → { configured:false } et le client
 * retombe sur la lecture directe / hls.js. Aucun nom de prestataire n'est
 * exposé côté client (clés + hôtes en variables d'env uniquement).
 */

const API = "https://video.bunnycdn.com";
const LIBRARY = process.env.BUNNY_STREAM_LIBRARY_ID;
const KEY = process.env.BUNNY_STREAM_API_KEY;
const CDN = process.env.BUNNY_STREAM_CDN_HOST; // ex. vz-xxxx.b-cdn.net

// Dédoublonnage best-effort par instance : source → guid (évite de recréer
// une vidéo à chaque lecture).
const cache = new Map<string, string>();

function configured(): boolean {
  return Boolean(LIBRARY && KEY && CDN);
}
function hlsUrl(guid: string): string {
  return `https://${CDN}/${guid}/playlist.m3u8`;
}
function allowedSource(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    // Sources Meta + nos archives média (CDN de stockage). Les créatives du feed
    // commun ont leur URL réécrite vers le CDN d'archive : elles doivent aussi
    // pouvoir être transcodées pour une lecture fiable.
    const archiveHost = (process.env.BUNNY_CDN_HOST || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return (
      h.endsWith("fbcdn.net") ||
      h.endsWith("facebook.com") ||
      h.endsWith("b-cdn.net") ||
      (archiveHost !== "" && h === archiveHost)
    );
  } catch {
    return false;
  }
}

// Titre déterministe par source → permet de RETROUVER une vidéo déjà transcodée
// (même sur une autre instance serverless / après un cold start) au lieu d'en
// recréer une à chaque lecture (évite les transcodages/coûts en double).
function titleFor(source: string): string {
  return `look360:${createHash("sha1").update(source).digest("hex")}`;
}

// Recherche une vidéo déjà créée pour cette source (par son titre déterministe).
async function findExistingGuid(source: string): Promise<string | null> {
  const title = titleFor(source);
  try {
    const r = await fetch(
      `${API}/library/${LIBRARY}/videos?search=${encodeURIComponent(title)}&itemsPerPage=20&page=1`,
      { headers: { AccessKey: KEY as string, accept: "application/json" }, cache: "no-store" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { items?: { guid?: string; title?: string }[] };
    const hit = (j.items || []).find((v) => v.title === title && v.guid);
    return hit?.guid ?? null;
  } catch {
    return null;
  }
}
async function statusOf(guid: string): Promise<number | null> {
  const r = await fetch(`${API}/library/${LIBRARY}/videos/${guid}`, {
    headers: { AccessKey: KEY as string, accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { status?: number };
  return typeof j.status === "number" ? j.status : null;
}
// Bunny status: 4 = Finished (encodé, prêt). >=3 = premières renditions dispo.
function readyFrom(status: number | null): boolean {
  return status !== null && status >= 4;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!configured()) {
    return NextResponse.json({ configured: false });
  }

  const sp = new URL(request.url).searchParams;
  const guidParam = sp.get("guid");
  const source = sp.get("url");

  try {
    // Polling d'un transcodage en cours.
    if (guidParam) {
      const status = await statusOf(guidParam);
      const ready = readyFrom(status);
      return NextResponse.json({
        configured: true,
        guid: guidParam,
        status,
        ready,
        error: status === 5 || status === 6,
        hls: ready ? hlsUrl(guidParam) : null,
      });
    }

    if (!source) {
      return NextResponse.json({ error: "url requise" }, { status: 400 });
    }
    if (!allowedSource(source)) {
      return NextResponse.json({ error: "source non autorisée" }, { status: 400 });
    }

    // Déjà connu (cache instance) ou déjà transcodé (recherche par titre) →
    // renvoyer son statut sans recréer de vidéo.
    const known = cache.get(source) ?? (await findExistingGuid(source));
    if (known) {
      cache.set(source, known);
      const status = await statusOf(known);
      const ready = readyFrom(status);
      return NextResponse.json({
        configured: true,
        guid: known,
        status,
        ready,
        error: status === 5 || status === 6,
        hls: ready ? hlsUrl(known) : null,
      });
    }

    // Créer la vidéo (titre déterministe) puis lancer la récupération depuis la
    // source (transcodage).
    const create = await fetch(`${API}/library/${LIBRARY}/videos`, {
      method: "POST",
      headers: {
        AccessKey: KEY as string,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ title: titleFor(source) }),
    });
    if (!create.ok) {
      return NextResponse.json({ configured: true, error: true }, { status: 502 });
    }
    const { guid } = (await create.json()) as { guid: string };
    cache.set(source, guid);

    await fetch(`${API}/library/${LIBRARY}/videos/${guid}/fetch`, {
      method: "POST",
      headers: {
        AccessKey: KEY as string,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ url: source }),
    });

    return NextResponse.json({
      configured: true,
      guid,
      status: 0,
      ready: false,
      error: false,
      hls: null,
    });
  } catch {
    return NextResponse.json({ configured: true, error: true }, { status: 502 });
  }
}
