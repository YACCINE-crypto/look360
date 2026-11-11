"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import type { ReferralSettings } from "@/lib/referralFormat";
import { processPayout, saveSettings } from "./actions";

export function PayoutActions({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (status: "paid" | "rejected") =>
    start(async () => {
      if (status === "rejected" && !window.confirm("Refuser ce retrait ? Le montant redevient disponible pour l'affilié.")) return;
      const r = await processPayout(id, status, note);
      setErr(r.ok ? null : (r.error ?? "Erreur"));
    });
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`note-${id}`}>
          Référence du transfert
        </label>
        <input
          id={`note-${id}`}
          placeholder="Réf. transfert"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border-border bg-surface text-fg focus:border-accent h-9 w-32 rounded-md border px-2 text-xs outline-none"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => act("paid")}
          className="bg-accent text-accent-on hover:bg-accent-hover inline-flex h-9 items-center gap-1 rounded-md px-3 text-xs font-semibold disabled:opacity-50"
        >
          <Check size={14} /> Marquer payé
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("rejected")}
          aria-label="Refuser le retrait"
          className="border-border text-fg-2 hover:bg-input grid h-9 w-9 place-items-center rounded-md border disabled:opacity-50"
        >
          <X size={14} />
        </button>
      </div>
      {err && <span className="text-danger-fg text-xs">{err}</span>}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: ReferralSettings }) {
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const num = (k: keyof ReferralSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });
  const field = "border-border bg-surface text-fg focus:border-accent mt-1 h-10 w-full rounded-md border px-3 text-sm tabular-nums outline-none";
  return (
    <form
      className="grid gap-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSettings(f);
          setMsg(r.ok ? { ok: true, text: "Règles enregistrées. Elles s'appliquent aux prochains paiements." } : { ok: false, text: r.error ?? "Erreur" });
        });
      }}
    >
      <label className="text-sm">
        <span className="text-fg font-semibold">Type de commission</span>
        <select value={f.commission_type} onChange={(e) => setF({ ...f, commission_type: e.target.value as "percent" | "fixed" })} className={field}>
          <option value="percent">Pourcentage du paiement</option>
          <option value="fixed">Montant fixe</option>
        </select>
      </label>
      {f.commission_type === "percent" ? (
        <label className="text-sm">
          <span className="text-fg font-semibold">Taux (%)</span>
          <input type="number" min={0} max={100} step="0.5" value={f.rate_pct} onChange={num("rate_pct")} className={field} />
        </label>
      ) : (
        <label className="text-sm">
          <span className="text-fg font-semibold">Montant par paiement (F)</span>
          <input type="number" min={0} step={100} value={f.fixed_amount} onChange={num("fixed_amount")} className={field} />
        </label>
      )}
      <label className="text-sm">
        <span className="text-fg font-semibold">Paiements commissionnés</span>
        <input type="number" min={0} max={36} value={f.months} onChange={num("months")} className={field} />
      </label>
      <label className="text-sm">
        <span className="text-fg font-semibold">Validité du clic (jours)</span>
        <input type="number" min={1} max={365} value={f.attribution_days} onChange={num("attribution_days")} className={field} />
      </label>
      <label className="text-sm">
        <span className="text-fg font-semibold">Seuil de retrait (F)</span>
        <input type="number" min={0} step={500} value={f.min_payout} onChange={num("min_payout")} className={field} />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className="bg-accent text-accent-on hover:bg-accent-hover h-10 w-full rounded-md px-4 text-sm font-semibold disabled:opacity-50">
          Enregistrer les règles
        </button>
      </div>
      {msg && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm font-medium sm:col-span-3 ${msg.ok ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
