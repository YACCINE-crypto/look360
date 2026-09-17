"use client";

import { useActionState, useEffect, useRef } from "react";
import { creerAgent } from "./actions";

const inputCls =
  "w-full min-h-[44px] rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-medium text-muted-foreground";

export function EquipeForm() {
  const [error, formAction, pending] = useActionState(creerAgent, null);
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(false);

  // Réinitialise le formulaire après un envoi réussi.
  useEffect(() => {
    if (prevPending.current && !pending && error === null) {
      formRef.current?.reset();
    }
    prevPending.current = pending;
  }, [pending, error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-border bg-surface shadow-card space-y-4 rounded-xl border p-5"
    >
      <h2 className="text-sm font-semibold">Ajouter un commercial</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className={labelCls}>Nom</span>
          <input name="nom" placeholder="ex. Awa Koné" className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className={labelCls}>Email *</span>
          <input
            name="email"
            type="email"
            required
            placeholder="agent@exemple.com"
            className={inputCls}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelCls}>Mot de passe *</span>
          <input
            name="password"
            type="text"
            required
            minLength={6}
            placeholder="6 caractères min."
            className={inputCls}
          />
        </label>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground inline-flex min-h-[44px] items-center rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer le compte"}
      </button>
      <p className="text-muted-foreground text-xs">
        Le compte est créé et confirmé immédiatement. Le commercial se connecte
        avec cet email et ce mot de passe, et ses produits arrivent dans ta file
        de validation.
      </p>
    </form>
  );
}
