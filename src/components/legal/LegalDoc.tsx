import type { ReactNode } from "react";

/**
 * Met en page un texte juridique brut (fourni tel quel) pour le thème « Nuit » :
 *   « 1. Titre »      → h2 (avec ancre + sommaire)
 *   « 1.1. Titre »    → h3
 *   « * élément »     → liste à puces
 *   « Libellé : … »   → libellé en gras (éditeur, e-mail, droits…)
 *   URL / e-mail      → liens cliquables
 * La 1re ligne (titre) et « Dernière mise à jour » sont affichées dans l'en-tête.
 */

type Block =
  | { kind: "h2"; id: string; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "label"; text: string }
  | { kind: "p"; text: string };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export function parseLegal(raw: string): { title: string; updated: string | null; blocks: Block[] } {
  const lines = raw.split("\n").map((l) => l.trim());
  const title = lines.find((l) => l) ?? "";
  let updated: string | null = null;
  const blocks: Block[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (list) blocks.push({ kind: "ul", items: list });
    list = null;
  };

  for (const line of lines.slice(lines.indexOf(title) + 1)) {
    if (!line || line === "⸻") {
      flush();
      continue;
    }
    const upd = /^Dernière mise à jour\s*:\s*(.+)$/i.exec(line);
    if (upd && !updated) {
      updated = upd[1];
      continue;
    }
    if (line.startsWith("* ")) {
      (list ??= []).push(line.slice(2));
      continue;
    }
    flush();
    if (/^\d+\.\d+\.\s/.test(line)) blocks.push({ kind: "h3", text: line });
    else if (/^\d+\.\s/.test(line)) blocks.push({ kind: "h2", id: slug(line.replace(/^\d+\.\s*/, "")), text: line });
    // Intertitre court terminé par « : » (« Gestion des comptes : »).
    else if (/:\s*$/.test(line) && line.split(/\s+/).length <= 5) blocks.push({ kind: "label", text: line });
    else blocks.push({ kind: "p", text: line });
  }
  flush();
  return { title, updated, blocks };
}

const LINK_RE = /(https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.]+)/g;

/** Texte avec URL et e-mails cliquables (liens internes look360.io → chemins relatifs). */
function rich(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const v = m[0].replace(/[.,;]$/, "");
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    if (v.includes("@") && !v.startsWith("http")) {
      out.push(
        <a key={i} href={`mailto:${v}`}>
          {v}
        </a>,
      );
    } else {
      const internal = v.replace(/^https?:\/\/(www\.)?look360\.io/i, "") || "/";
      out.push(
        <a key={i} href={internal.startsWith("/") ? internal : v}>
          {v}
        </a>,
      );
    }
    last = i + v.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** « Libellé : suite » → libellé en gras quand le libellé est court. */
function labelled(text: string): ReactNode {
  const m = /^([^:]{2,45}?)\s:\s(.+)$/.exec(text);
  if (m && m[1].split(/\s+/).length <= 5) {
    return (
      <>
        <strong>{m[1]}</strong> : {rich(m[2])}
      </>
    );
  }
  return rich(text);
}

export function LegalDoc({ raw, title: heading, intro }: { raw: string; title?: string; intro?: string }) {
  const { title, updated, blocks } = parseLegal(raw);
  const toc = blocks.filter((b): b is Extract<Block, { kind: "h2" }> => b.kind === "h2");
  return (
    <article className="legal">
      <header className="legal-head">
        <p className="legal-eyebrow">Informations légales</p>
        <h1>{heading ?? title}</h1>
        {updated && <p className="legal-date">Dernière mise à jour : {updated}</p>}
        {intro && <p className="legal-intro">{intro}</p>}
      </header>

      {toc.length > 3 && (
        <nav className="legal-toc" aria-label="Sommaire">
          <p>Sommaire</p>
          <ol>
            {toc.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>{h.text.replace(/^\d+\.\s*/, "")}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="legal-body">
        {blocks.map((b, i) => {
          switch (b.kind) {
            case "h2":
              return (
                <h2 key={i} id={b.id}>
                  {b.text}
                </h2>
              );
            case "h3":
              return <h3 key={i}>{b.text}</h3>;
            case "label":
              return (
                <p key={i} className="legal-label">
                  {b.text}
                </p>
              );
            case "ul":
              return (
                <ul key={i}>
                  {b.items.map((it, j) => (
                    <li key={j}>{labelled(it)}</li>
                  ))}
                </ul>
              );
            default:
              return <p key={i}>{labelled(b.text)}</p>;
          }
        })}
      </div>
    </article>
  );
}
