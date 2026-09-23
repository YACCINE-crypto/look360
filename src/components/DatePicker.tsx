"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const DOW = ["L", "M", "M", "J", "V", "S", "D"]; // lundi → dimanche

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseIso(v: string | null | undefined): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmt(v: string | null): string {
  const d = parseIso(v);
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Sélecteur de date maison (remplace <input type="date">, dont le rendu
 * dépend du navigateur/OS). Calendrier stylé au design system, `name` → émet
 * un <input hidden> (valeur YYYY-MM-DD) pour un <form action={...}>.
 */
export function DatePicker({
  name,
  defaultValue = "",
  placeholder = "Choisir une date",
  className = "",
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

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

  // Grille du mois : décalage sur lundi (getDay(): 0=dim → 6).
  const cells = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(new Date(y, m, d));
    return out;
  }, [view]);

  const todayIso = iso(new Date());

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`border-border bg-input focus:border-primary flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border px-3 text-sm outline-none transition-colors ${
          open ? "border-primary" : ""
        }`}
      >
        <span className={value ? "" : "text-muted-foreground"}>{value ? fmt(value) : placeholder}</span>
        <Icon name="calendar" size={16} className="text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="border-border bg-surface absolute z-50 mt-1 w-[17rem] rounded-xl border p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="hover:bg-input grid h-8 w-8 place-items-center rounded-md"
              aria-label="Mois précédent"
            >
              <Icon name="chevronRight" size={16} className="rotate-180" />
            </button>
            <span className="text-sm font-semibold capitalize">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="hover:bg-input grid h-8 w-8 place-items-center rounded-md"
              aria-label="Mois suivant"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>

          <div className="text-muted-foreground mb-1 grid grid-cols-7 text-center text-[11px] font-medium">
            {DOW.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const di = iso(d);
              const isSel = di === value;
              const isToday = di === todayIso;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setValue(di);
                    setOpen(false);
                  }}
                  className={`grid h-9 place-items-center rounded-md text-sm transition-colors ${
                    isSel
                      ? "bg-primary text-primary-foreground font-semibold"
                      : isToday
                        ? "text-primary font-semibold hover:bg-input"
                        : "hover:bg-input"
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                setValue("");
                setOpen(false);
              }}
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(todayIso);
                setView(new Date());
                setOpen(false);
              }}
              className="text-primary text-xs font-semibold"
            >
              Aujourd&apos;hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
