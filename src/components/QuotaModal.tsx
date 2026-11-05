"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

/** Refus renvoyé par le serveur (quotaRefusal) quand une recherche est bloquée. */
export type QuotaRefusal = {
  error: "quota_atteint" | "email_non_verifie";
  plan: string;
  limite: number;
  message: string;
};

const NEXT_PLAN: Record<string, { label: string; searches: number } | null> = {
  free: { label: "Starter", searches: 200 },
  starter: { label: "Pro", searches: 400 },
  pro: { label: "Business", searches: 600 },
  business: null,
};

export function isQuotaRefusal(x: unknown): x is QuotaRefusal {
  const e = (x as { error?: unknown } | null)?.error;
  return e === "quota_atteint" || e === "email_non_verifie";
}

/**
 * Modale d'upgrade quand le SERVEUR refuse une recherche. Purement
 * informative : la limite est appliquée en base, cette fenêtre l'explique.
 */
export function QuotaModal({ refusal, onClose }: { refusal: QuotaRefusal | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (refusal && !d.open) d.showModal();
    if (!refusal && d.open) d.close();
  }, [refusal]);

  const email = refusal?.error === "email_non_verifie";
  const next = refusal ? NEXT_PLAN[refusal.plan] ?? null : null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="quota-title"
      className="bg-surface text-fg shadow-raised m-auto w-[min(92vw,420px)] rounded-2xl p-0 backdrop:bg-black/50"
    >
      {refusal && (
        <div className="p-6 text-center">
          <span className="bg-secondary text-accent mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full">
            <Icon name={email ? "mail" : "lock"} size={26} />
          </span>
          <h2 id="quota-title" className="text-lg font-bold">
            {email ? "Confirme ton adresse e-mail" : `Tes ${refusal.limite} recherches du mois sont utilisées`}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">{refusal.message}</p>
          {!email && next && (
            <p className="text-fg mt-3 text-sm">
              Avec <b>{next.label}</b> : <b>{next.searches}</b> recherches par mois.
            </p>
          )}
          <p className="text-muted-foreground mt-2 text-xs">
            Les recherches déjà en cache restent gratuites et illimitées.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:justify-center">
            {!email && next && (
              <Link
                href="/offres"
                className="bg-accent text-accent-on hover:bg-accent-hover inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition-colors"
              >
                Passer à {next.label}
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="border-border hover:bg-input inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
