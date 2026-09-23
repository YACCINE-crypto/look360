"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [error, formAction, pending] = useActionState(login, null);
  const params = useSearchParams();
  const reset = params.get("reset") === "1";
  const authError = params.get("error") === "auth";

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/look360-logo.svg"
            alt="Look360"
            className="mb-3 h-12 w-auto"
          />
          <p className="text-muted-foreground text-sm">
            Recherche &amp; testing produit COD
          </p>
        </div>

        {reset && (
          <div className="bg-success-bg text-success mb-4 rounded-md p-3 text-sm">
            Mot de passe mis à jour. Connecte-toi.
          </div>
        )}
        {authError && (
          <div className="bg-danger-bg text-danger mb-4 rounded-md p-3 text-sm">
            Lien invalide ou expiré. Réessaie de te connecter ou de réinitialiser.
          </div>
        )}

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

          <div className="flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
              Mot de passe oublié ?
            </Link>
            <Link href="/signup" className="text-primary font-semibold hover:underline">
              Créer un compte
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
