// ============================================================================
// Hôtes média autorisés (anti-SSRF / anti-XSS), partagés par les routes qui
// récupèrent une URL média fournie par le client. Correspondance EXACTE ou sur
// une frontière de sous-domaine (".fbcdn.net") : "evilfbcdn.net" ou
// "x.b-cdn.net" quelconque ne passent plus.
// ============================================================================

function hostUnder(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

/** Host du CDN d'archive configuré (BUNNY_CDN_HOST), sans schéma ni "/". */
export function archiveCdnHost(): string {
  return (process.env.BUNNY_CDN_HOST || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .replace(/\.+$/, "")
    .toLowerCase();
}

/** CDN Meta (sources des pubs). */
export function isMetaMediaHost(host: string): boolean {
  const h = host.toLowerCase();
  return hostUnder(h, "fbcdn.net") || hostUnder(h, "facebook.com");
}

/** URL https vers le CDN Meta ou vers NOTRE CDN d'archive (exact). */
export function isAllowedMediaUrl(url: string, opts: { archive: boolean }): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (isMetaMediaHost(parsed.hostname)) return true;
  const archive = archiveCdnHost();
  return opts.archive && archive !== "" && parsed.hostname.toLowerCase().replace(/\.+$/, "") === archive;
}

/**
 * fetch() qui suit les redirections (les CDN Meta redirigent souvent vers un
 * autre edge) en revérifiant CHAQUE étape contre la liste d'hôtes : une
 * redirection vers un hôte non autorisé est refusée (anti-SSRF). Max 4 sauts.
 */
export async function fetchAllowedMedia(
  url: string,
  init: RequestInit,
  opts: { archive: boolean },
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= 4; hop++) {
    if (!isAllowedMediaUrl(current, opts)) throw new Error("redirect_not_allowed");
    const r = await fetch(current, { ...init, redirect: "manual" });
    const loc = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
    if (!loc) return r;
    current = new URL(loc, current).toString();
  }
  throw new Error("too_many_redirects");
}
