"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="bg-primary text-primary-foreground mb-3 grid h-11 w-11 place-items-center rounded-lg text-lg font-bold">
            L
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Look360</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Recherche &amp; testing produit COD
          </p>
        </div>

        <form
          action={formAction}
          className="border-border bg-surface space-y-4 rounded-xl border p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="border-border bg-input focus:border-primary w-full min-h-[44px] rounded-md border px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="border-border bg-input focus:border-primary w-full min-h-[44px] rounded-md border px-3 py-2 text-sm outline-none"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </main>
  );
}
