"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
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
            <label className="block space-y-1.5">
              <span className={labelCls}>Ancienneté min. (j)</span>
              <select name="anciennete_min" defaultValue={String(config.anciennete_min)} className={inputCls}>
                {[0, 15, 30, 60, 90].map((v) => (
                  <option key={v} value={v}>{v === 0 ? "Toutes" : `${v} j`}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Reach min. UE</span>
              <select name="reach_min" defaultValue={String(config.reach_min)} className={inputCls}>
                {[0, 50000, 100000, 500000, 1000000].map((v) => (
                  <option key={v} value={v}>{v === 0 ? "Aucun" : v.toLocaleString("fr-FR")}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Score min.</span>
              <select name="score_min" defaultValue={String(config.score_min)} className={inputCls}>
                {[40, 50, 60, 70, 80].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Nb max de winners</span>
              <select name="results_max" defaultValue={String(config.results_max)} className={inputCls}>
                {[5, 10, 15, 20].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
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
