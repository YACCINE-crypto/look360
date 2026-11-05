"use client";

import { useState, useTransition } from "react";
import { Check, MessageCircle, SlidersHorizontal } from "lucide-react";
import { saveWhatsapp, savePreferences } from "@/lib/onboarding/actions";
import { ONBOARDING_MARKETS, ONBOARDING_NICHES } from "@/lib/onboarding/options";

/** WhatsApp : numéro + consentement aux alertes (opt-in explicite, opt-out ici). */
export function WhatsAppSettings({ number, optin }: { number: string | null; optin: boolean }) {
  const [phone, setPhone] = useState(number ?? "");
  const [on, setOn] = useState(optin);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (nextOn: boolean) =>
    start(async () => {
      const res = await saveWhatsapp(phone, nextOn);
      if (res.ok) {
        setOn(nextOn);
        setMsg({ ok: true, text: nextOn ? "Alertes WhatsApp activées." : "Préférences WhatsApp enregistrées." });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="bg-secondary text-accent grid h-9 w-9 shrink-0 place-items-center rounded-lg">
          <MessageCircle size={18} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-fg text-sm font-semibold">Alertes WhatsApp</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            Winners et infos Look360 sur WhatsApp (offres Pro et Business). Uniquement avec ton accord, désactivable ici ou en répondant STOP.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Recevoir les alertes et infos sur WhatsApp"
          disabled={pending}
          onClick={() => save(!on)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 ${
            on ? "bg-accent" : "bg-input"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          save(on);
        }}
      >
        <label className="sr-only" htmlFor="wa-number">
          Numéro WhatsApp
        </label>
        <input
          id="wa-number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+225 07 00 00 00 00"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border-border bg-bg text-fg focus:border-accent min-h-11 flex-1 rounded-md border px-3 text-base outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="border-border hover:bg-input min-h-11 rounded-md border px-4 text-sm font-semibold disabled:opacity-60"
        >
          Enregistrer le numéro
        </button>
      </form>
      {msg && (
        <p className={`text-xs font-medium ${msg.ok ? "text-success" : "text-danger"}`} role="status">
          {msg.text}
        </p>
      )}
    </div>
  );
}

/** Niches + marchés mis en avant dans le feed. */
export function FeedPreferences({ niches: n0, markets: m0 }: { niches: string[]; markets: string[] }) {
  const [niches, setNiches] = useState(n0);
  const [markets, setMarkets] = useState(m0);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors ${
      active ? "border-accent bg-secondary text-accent" : "border-border bg-surface text-fg-2 hover:bg-input"
    }`;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start gap-3">
        <span className="bg-secondary text-accent grid h-9 w-9 shrink-0 place-items-center rounded-lg">
          <SlidersHorizontal size={18} strokeWidth={1.9} />
        </span>
        <div>
          <p className="text-fg text-sm font-semibold">Niches et marchés</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">Mis en avant en premier dans ton feed.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ONBOARDING_NICHES.map((v) => (
          <button key={v} type="button" aria-pressed={niches.includes(v)} className={chip(niches.includes(v))} onClick={() => toggle(niches, setNiches, v)}>
            {niches.includes(v) && <Check size={13} />} {v}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {ONBOARDING_MARKETS.map((m) => (
          <button key={m.code} type="button" aria-pressed={markets.includes(m.code)} className={chip(markets.includes(m.code))} onClick={() => toggle(markets, setMarkets, m.code)}>
            {markets.includes(m.code) && <Check size={13} />} {m.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await savePreferences(niches, markets);
              setSaved(r.ok ? "Préférences enregistrées." : r.error);
            })
          }
          className="bg-accent text-accent-on hover:bg-accent-hover min-h-10 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
        >
          Enregistrer
        </button>
        {saved && <span className="text-muted-foreground text-xs">{saved}</span>}
      </div>
    </div>
  );
}
