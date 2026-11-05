/**
 * Destination de redirection après connexion : chemin INTERNE uniquement.
 * Refuse les URL absolues, « //domaine » et « /\domaine » (redirections ouvertes
 * vers un site tiers). Repli : `fallback`.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
