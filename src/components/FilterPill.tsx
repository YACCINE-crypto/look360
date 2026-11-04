"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Pastille de filtre compacte (barre de filtres type « Ads Explorer ») :
 * libellé + valeur courante, ouvre un panneau flottant. Active = accent.
 * Le panneau se recale à droite s'il dépasse l'écran.
 */
export function FilterPill({
  label,
  value,
  count,
  active = false,
  icon,
  disabled = false,
  title,
  align = "left",
  children,
}: {
  label: string;
  /** Résumé affiché après le libellé quand le filtre est actif (ex. « 7–30 j »). */
  value?: string | null;
  /** Pastille numérique (ex. nombre de pays). */
  count?: number;
  active?: boolean;
  icon?: IconName;
  disabled?: boolean;
  title?: string;
  align?: "left" | "right";
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(align === "right");
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Recalage horizontal : à droite si le panneau sort de l'écran.
  useLayoutEffect(() => {
    if (!open || !ref.current || !panel.current) return;
    const r = ref.current.getBoundingClientRect();
    const w = panel.current.offsetWidth;
    const overflowRight = r.left + w > window.innerWidth - 16;
    const fitsLeft = r.right - w >= 16;
    const next = align === "right" ? fitsLeft || !overflowRight : overflowRight && fitsLeft;
    if (next !== flip) setFlip(next);
  }, [open, align, flip]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          active
            ? "border-accent bg-secondary text-accent"
            : open
              ? "border-accent bg-surface text-fg"
              : "border-border bg-surface text-fg-2 hover:bg-input hover:text-fg"
        }`}
      >
        {icon && <Icon name={icon} size={14} />}
        <span>{label}</span>
        {active && value && <span className="font-semibold">· {value}</span>}
        {count != null && count > 0 && (
          <span className="bg-accent text-accent-on grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-bold tabular-nums">
            {count}
          </span>
        )}
        <Icon name="chevronDown" size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label={label}
          className={`border-border bg-surface shadow-raised absolute top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border p-3 ${
            flip ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Pastille on/off (ex. « Paiement à la livraison »). */
export function FilterToggle({
  label,
  on,
  onChange,
  icon,
  title,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  icon?: IconName;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={() => onChange(!on)}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        on ? "border-accent bg-secondary text-accent" : "border-border bg-surface text-fg-2 hover:bg-input hover:text-fg"
      }`}
    >
      {on ? <Icon name="check" size={14} /> : icon && <Icon name={icon} size={14} />}
      {label}
    </button>
  );
}

/** En-tête de panneau : titre + aide courte. */
export function PanelHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2.5">
      <p className="text-fg text-sm font-bold">{title}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

export type PillOption = { value: string; label: string; hint?: string; icon?: IconName };

/** Liste d'options à choix unique : un clic applique et ferme. */
export function OptionList({
  options,
  value,
  onPick,
}: {
  options: PillOption[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
              sel ? "border-accent bg-secondary" : "hover:bg-input border-transparent"
            }`}
          >
            {o.icon && (
              <span className={`mt-0.5 shrink-0 ${sel ? "text-accent" : "text-muted-foreground"}`}>
                <Icon name={o.icon} size={16} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold ${sel ? "text-accent" : "text-fg"}`}>{o.label}</span>
              {o.hint && <span className="text-muted-foreground block text-xs">{o.hint}</span>}
            </span>
            {sel && <Icon name="check" size={16} className="text-accent mt-0.5 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
