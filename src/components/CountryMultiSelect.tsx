"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  SPY_COUNTRIES,
  SPY_REGION_LABELS,
  SPY_COUNTRIES_HARD,
  countryLabel,
  isEUCountry,
  type SpyRegion,
} from "@/lib/spy";

const REGIONS: SpyRegion[] = ["africa", "europe", "other"];

/**
 * Sélecteur de pays multi-sélection (page Spy). Cases à cocher (plusieurs
 * pays, régions mélangées), raccourcis par région, filtre texte, indication
 * « reach » sur l'UE, chips retirables. Plafonné à SPY_COUNTRIES_HARD car
 * chaque pays = 1 appel Apify (contrôle du coût).
 */
export function CountryMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState<string | null>(null);
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

  const sel = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return SPY_COUNTRIES;
    return SPY_COUNTRIES.filter(
      (c) => c.label.toLowerCase().includes(f) || c.code.toLowerCase().includes(f),
    );
  }, [filter]);

  function toggle(code: string) {
    setNote(null);
    if (sel.has(code)) {
      onChange(selected.filter((c) => c !== code));
      return;
    }
    if (selected.length >= SPY_COUNTRIES_HARD) {
      setNote(`Maximum ${SPY_COUNTRIES_HARD} pays par recherche (coût Apify).`);
      return;
    }
    onChange([...selected, code]);
  }

  function selectRegion(region: SpyRegion) {
    setNote(null);
    const codes = SPY_COUNTRIES.filter((c) => c.region === region).map((c) => c.code);
    const merged = Array.from(new Set([...selected, ...codes]));
    if (merged.length > SPY_COUNTRIES_HARD) {
      onChange(merged.slice(0, SPY_COUNTRIES_HARD));
      setNote(
        `${SPY_REGION_LABELS[region]} compte ${codes.length} pays. Limité à ${SPY_COUNTRIES_HARD} par recherche pour maîtriser le coût — affine ta sélection.`,
      );
    } else {
      onChange(merged);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`border-border bg-input focus:border-primary flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border px-3 text-sm outline-none transition-colors ${
          open ? "border-primary" : ""
        }`}
      >
        <span className={selected.length ? "" : "text-muted-foreground"}>
          {selected.length === 0
            ? "Choisir des pays"
            : `${selected.length} pays sélectionné${selected.length > 1 ? "s" : ""}`}
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={`text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Chips sélectionnés (toujours visibles, retirables) */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <span
              key={code}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium"
            >
              {countryLabel(code)}
              <button
                type="button"
                onClick={() => onChange(selected.filter((c) => c !== code))}
                className="hover:bg-primary/15 grid h-4 w-4 place-items-center rounded-full"
                aria-label={`Retirer ${countryLabel(code)}`}
              >
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
          {selected.length > 1 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-muted-foreground hover:text-foreground text-xs font-medium underline"
            >
              Tout effacer
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="border-border bg-surface absolute z-50 mt-1 w-full min-w-[16rem] rounded-xl border p-2 shadow-xl">
          {/* Filtre texte */}
          <div className="border-border bg-input mb-2 flex min-h-[38px] items-center gap-2 rounded-md border px-2.5">
            <Icon name="search" size={14} className="text-muted-foreground" />
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher un pays…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          {/* Raccourcis région */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => selectRegion(r)}
                className="bg-input hover:bg-muted text-foreground rounded-full px-2.5 py-1 text-xs font-medium"
              >
                Tout · {SPY_REGION_LABELS[r]}
              </button>
            ))}
          </div>

          {note && <p className="text-warning mb-2 px-1 text-xs">{note}</p>}

          {/* Liste par région */}
          <div className="max-h-64 overflow-auto">
            {REGIONS.map((r) => {
              const list = filtered.filter((c) => c.region === r);
              if (list.length === 0) return null;
              return (
                <div key={r}>
                  <p className="text-muted-foreground px-1 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide">
                    {SPY_REGION_LABELS[r]}
                  </p>
                  {list.map((c) => {
                    const checked = sel.has(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggle(c.code)}
                        className={`flex min-h-[38px] w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors ${
                          checked ? "bg-secondary/60" : "hover:bg-input"
                        }`}
                      >
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
                            checked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border"
                          }`}
                        >
                          {checked && <Icon name="check" size={11} />}
                        </span>
                        <span className="flex-1 truncate">{c.label}</span>
                        {isEUCountry(c.code) && (
                          <span className="bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                            reach
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-muted-foreground px-2 py-3 text-center text-sm">Aucun pays trouvé.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
