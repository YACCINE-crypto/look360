"use client";

import { useMemo, useState } from "react";
import { AdGrid } from "@/components/AdGrid";
import { Icon } from "@/components/Icon";
import { countryLabel, isEUCountry, type SpyAd } from "@/lib/spy";

type Zone = "all" | "africa" | "europe";
type Sort = "score" | "age" | "reach";

const chip =
  "border-border bg-surface text-fg-2 hover:bg-input focus-visible:ring-accent/40 h-9 shrink-0 cursor-pointer rounded-full border pl-3 pr-8 text-sm font-medium focus-visible:outline-none focus-visible:ring-2";

/** Feed du jour : filtres instantanés (côté client) sur les pubs du jour. */
export function FeedClient({ ads }: { ads: SpyAd[] }) {
  const [zone, setZone] = useState<Zone>("all");
  const [format, setFormat] = useState<"all" | "video" | "image">("all");
  const [country, setCountry] = useState("all");
  const [minDays, setMinDays] = useState(0);
  const [sort, setSort] = useState<Sort>("score");

  const inZone = (a: SpyAd, z: Zone) =>
    z === "all" ? true : z === "europe" ? isEUCountry(a.country) || a.targets_eu : !(isEUCountry(a.country) || a.targets_eu);

  const counts = useMemo(
    () => ({
      all: ads.length,
      africa: ads.filter((a) => inZone(a, "africa")).length,
      europe: ads.filter((a) => inZone(a, "europe")).length,
    }),
    [ads],
  );

  const countries = useMemo(
    () =>
      [...new Set(ads.filter((a) => inZone(a, zone)).map((a) => a.country).filter(Boolean) as string[])].sort(
        (a, b) => countryLabel(a).localeCompare(countryLabel(b), "fr"),
      ),
    [ads, zone],
  );

  const list = useMemo(() => {
    const out = ads.filter(
      (a) =>
        inZone(a, zone) &&
        (format === "all" || a.media_type === format) &&
        (country === "all" || a.country === country) &&
        (a.jours_actifs ?? 0) >= minDays,
    );
    return [...out].sort((a, b) =>
      sort === "age"
        ? (b.jours_actifs ?? 0) - (a.jours_actifs ?? 0)
        : sort === "reach"
          ? (b.reach ?? -1) - (a.reach ?? -1)
          : b.score - a.score,
    );
  }, [ads, zone, format, country, minDays, sort]);

  const filtered = format !== "all" || country !== "all" || minDays > 0;

  return (
    <div className="space-y-4">
      <div className="border-border-soft -mx-1 flex items-center gap-2 overflow-x-auto border-b px-1 pb-4">
        <div role="tablist" aria-label="Zone" className="bg-input flex shrink-0 gap-0.5 rounded-lg p-0.5">
          {(
            [
              ["all", "Tous"],
              ["africa", "Afrique"],
              ["europe", "Europe"],
            ] as [Zone, string][]
          ).map(([z, label]) => (
            <button
              key={z}
              role="tab"
              aria-selected={zone === z}
              onClick={() => {
                setZone(z);
                setCountry("all");
              }}
              className={`focus-visible:ring-accent/40 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                zone === z ? "bg-surface text-fg shadow-card font-semibold" : "text-fg-2 hover:text-fg"
              }`}
            >
              {label} <span className="text-muted-foreground tabular-nums">{counts[z]}</span>
            </button>
          ))}
        </div>

        <FilterSelect label="Format" value={format} onChange={(v) => setFormat(v as typeof format)}>
          <option value="all">Tous formats</option>
          <option value="video">Vidéo</option>
          <option value="image">Image</option>
        </FilterSelect>
        <FilterSelect label="Pays" value={country} onChange={setCountry}>
          <option value="all">Tous pays</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {countryLabel(c)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="En diffusion depuis" value={String(minDays)} onChange={(v) => setMinDays(Number(v))}>
          <option value="0">Toute durée</option>
          <option value="30">30 j et plus</option>
          <option value="90">90 j et plus</option>
          <option value="180">180 j et plus</option>
        </FilterSelect>
        {filtered && (
          <button
            onClick={() => {
              setFormat("all");
              setCountry("all");
              setMinDays(0);
            }}
            className="text-accent shrink-0 px-2 text-sm font-medium hover:underline"
          >
            Effacer
          </button>
        )}
        <div className="ml-auto shrink-0">
          <FilterSelect label="Tri" value={sort} onChange={(v) => setSort(v as Sort)}>
            <option value="score">Tri : meilleur score</option>
            <option value="age">Tri : plus ancienne</option>
            <option value="reach">Tri : plus grande audience UE</option>
          </FilterSelect>
        </div>
      </div>

      {list.length > 0 ? (
        <AdGrid ads={list} />
      ) : (
        <div className="border-border bg-surface rounded-xl border border-dashed p-10 text-center">
          <p className="text-fg font-medium">Aucune pub ne correspond à ces filtres.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {zone === "europe" && counts.europe === 0
              ? "Les pubs européennes arrivent avec la prochaine collecte du matin."
              : "Élargis la durée ou le pays pour voir plus de pubs."}
          </p>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${chip} appearance-none ${value !== "all" && value !== "0" && value !== "score" ? "border-accent text-accent bg-secondary" : ""}`}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={14}
        className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
      />
    </label>
  );
}
