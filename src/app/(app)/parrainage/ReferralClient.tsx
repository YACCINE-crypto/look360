"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Send } from "lucide-react";
import { fcfa, PAYOUT_METHODS } from "@/lib/referralFormat";
import { requestPayout } from "./actions";

export function CopyLink({ link, compact = false }: { link: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          /* presse-papiers refusé : le lien reste sélectionnable */
        }
      }}
      className={`focus-visible:ring-accent/30 inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold outline-none focus-visible:ring-2 ${
        compact ? "border-border text-fg hover:bg-input border" : "bg-accent text-accent-on hover:bg-accent-hover"
      }`}
    >
      {done ? <Check size={16} /> : <Copy size={16} />}
      {done ? "Lien copié" : "Copier le lien"}
    </button>
  );
}

export function PayoutForm({ amount }: { amount: number }) {
  const [method, setMethod] = useState<string>("wave");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestPayout(method, phone);
          setMsg(r.ok ? { ok: true, text: `Demande envoyée : ${fcfa(r.amount)}.` } : { ok: false, text: r.error });
        });
      }}
    >
      <fieldset>
        <legend className="text-fg text-sm font-semibold">Recevoir sur</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PAYOUT_METHODS.map((m) => (
            <label
              key={m.id}
              className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md border px-2 text-sm font-medium ${
                method === m.id ? "border-accent bg-secondary text-accent" : "border-border text-fg-2 hover:bg-input"
              }`}
            >
              <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-fg text-sm font-semibold">Numéro mobile money</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="+225 07 00 00 00 00"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border-border bg-surface text-fg focus:border-accent focus-visible:ring-accent/30 mt-1 min-h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-accent-on hover:bg-accent-hover focus-visible:ring-accent/30 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold outline-none focus-visible:ring-2 disabled:opacity-60"
      >
        <Send size={16} /> Demander un retrait de {fcfa(amount)}
      </button>
      {msg && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm font-medium ${msg.ok ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
