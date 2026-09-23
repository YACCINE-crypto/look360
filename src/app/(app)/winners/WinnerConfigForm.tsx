"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { enregistrerConfigWinner } from "./actions";

const inputCls =
  "w-full min-h-[40px] rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-medium text-muted-foreground";

export type WinnerConfig = {
  active: boolean;
  keywords: string[];
  countries: string[];
  anciennete_min: number;
  reach_min: number;
  score_min: number;
  results_max: number;
};

export function WinnerConfigForm({ config }: { config: WinnerConfig }) {
  const [open, setOpen] = useState(false);
  const [anciennete, setAnciennete] = useState(String(config.anciennete_min));
  const [reach, setReach] = useState(String(config.reach_min));
  const [score, setScore] = useState(String(config.score_min));
  const [resultsMax, setResultsMax] = useState(String(config.results_max));

  return (
    <div className="border-border bg-surface rounded-xl border shadow-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="trophy" size={16} className="text-warning" />
          Critères du Winner Agent
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              config.active ? "bg-success-bg text-success" : "bg-input text-muted-foreground"
            }`}
          >
            {config.active ? "Actif" : "En pause"}
          </span>
        </span>
        <Icon name="chevronRight" size={16} className={open ? "rotate-90" : ""} />
      </button>

      {open && (
        <form action={enregistrerConfigWinner} className="space-y-3 border-t border-border p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={config.active} />
            Agent actif (recherche automatique chaque jour)
          </label>

          <label className="block space-y-1.5">
            <span className={labelCls}>Mots-clés / niches (séparés par des virgules)</span>
            <input name="keywords" defaultValue={config.keywords.join(", ")} placeholder="montre, ceinture, masseur" className={inputCls} />
          </label>

          <label className="block space-y-1.5">
            <span className={labelCls}>Pays cibles (codes, ex. CI, FR, SN)</span>
            <input name="countries" defaultValue={config.countries.join(", ")} placeholder="CI, FR" className={inputCls} />
          </label>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="space-y-1.5">
              <span className={labelCls}>Ancienneté min. (j)</span>
              <Select
                name="anciennete_min"
                value={anciennete}
                onChange={setAnciennete}
                ariaLabel="Ancienneté minimum"
                options={[0, 15, 30, 60, 90].map((v) => ({
                  value: String(v),
                  label: v === 0 ? "Toutes" : `${v} j`,
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <span className={labelCls}>Reach min. UE</span>
              <Select
                name="reach_min"
                value={reach}
                onChange={setReach}
                ariaLabel="Reach minimum UE"
                options={[0, 50000, 100000, 500000, 1000000].map((v) => ({
                  value: String(v),
                  label: v === 0 ? "Aucun" : v.toLocaleString("fr-FR"),
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <span className={labelCls}>Score min.</span>
              <Select
                name="score_min"
                value={score}
                onChange={setScore}
                ariaLabel="Score minimum"
                options={[40, 50, 60, 70, 80].map((v) => ({ value: String(v), label: String(v) }))}
              />
            </div>
            <div className="space-y-1.5">
              <span className={labelCls}>Nb max de winners</span>
              <Select
                name="results_max"
                value={resultsMax}
                onChange={setResultsMax}
                ariaLabel="Nombre max de winners"
                options={[5, 10, 15, 20].map((v) => ({ value: String(v), label: String(v) }))}
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-primary text-primary-foreground inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Icon name="check" size={15} /> Enregistrer les critères
          </button>
        </form>
      )}
    </div>
  );
}
