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
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
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
  return opts.archive && archive !== "" && parsed.hostname.toLowerCase() === archive;
}
