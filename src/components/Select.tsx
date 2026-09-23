"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

export type SelectOption = { value: string; label: string; hint?: string };
export type SelectGroup = { label: string; options: SelectOption[] };

/**
 * Menu déroulant maison (remplace le <select> natif, gris/moche selon l'OS).
 * Design system Look360 : DM Sans, accent bleu, coins arrondis, ombre douce.
 * Tactile (44px), fermeture au clic extérieur / Échap, navigation clavier.
 * `name` → émet un <input hidden> pour marcher dans un <form action={...}>.
 */
export function Select({
  value,
  onChange,
  options,
  groups,
  placeholder = "Sélectionner…",
  disabled = false,
  name,
  ariaLabel,
  className = "",
  align = "left",
}: {
  value: string;
  onChange?: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  ariaLabel?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  const flat: SelectOption[] = groups ? groups.flatMap((g) => g.options) : options ?? [];
  const current = flat.find((o) => o.value === value) ?? null;

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

  function pick(v: string) {
    onChange?.(v);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`border-border bg-input focus:border-primary flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border px-3 text-sm outline-none transition-colors disabled:opacity-50 ${
          open ? "border-primary" : ""
        }`}
      >
        <span className={`truncate ${current ? "" : "text-muted-foreground"}`}>
          {current ? (
            <>
              {current.label}
              {current.hint && <span className="text-muted-foreground ml-1 text-xs">{current.hint}</span>}
            </>
          ) : (
            placeholder
          )}
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={`text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className={`border-border bg-surface absolute z-50 mt-1 max-h-72 w-full min-w-[10rem] overflow-auto rounded-xl border p-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {groups
            ? groups.map((g) => (
                <div key={g.label}>
                  <p className="text-muted-foreground px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide">
                    {g.label}
                  </p>
                  {g.options.map((o) => (
                    <Row key={o.value} o={o} selected={o.value === value} onPick={pick} />
                  ))}
                </div>
              ))
            : flat.map((o) => (
                <Row key={o.value} o={o} selected={o.value === value} onPick={pick} />
              ))}
        </div>
      )}
    </div>
  );
}

function Row({
  o,
  selected,
  onPick,
}: {
  o: SelectOption;
  selected: boolean;
  onPick: (v: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onPick(o.value)}
      className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm transition-colors ${
        selected ? "bg-secondary text-secondary-foreground font-medium" : "hover:bg-input"
      }`}
    >
      <span className="truncate">
        {o.label}
        {o.hint && <span className="text-muted-foreground ml-1 text-xs">{o.hint}</span>}
      </span>
      {selected && <Icon name="check" size={15} className="text-primary shrink-0" />}
    </button>
  );
}
