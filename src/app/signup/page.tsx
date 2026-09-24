"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { signup } from "./actions";

const inputCls =
  "border-border bg-input focus:border-primary w-full min-h-[44px] rounded-md border px-3 py-2 text-sm outline-none";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const [error, formAction, pending] = useActionState(signup, null);
  const sent = useSearchParams().get("sent") === "1";

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/look360-logo.svg" alt="Look360" className="mb-3 h-12 w-auto" />
          <p className="text-muted-foreground text-sm">Crée ton compte gratuit</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Sans carte bancaire · crédits offerts chaque mois
          </p>
        </div>

        {sent ? (
          <div className="border-border bg-surface space-y-3 rounded-xl border p-6 text-center shadow-sm">
            <p className="font-semibold">Vérifie ta boîte mail 📩</p>
            <p className="text-muted-foreground text-sm">
              On t&apos;a envoyé un lien de confirmation. Clique dessus pour activer
              ton compte, puis connecte-toi.
            </p>
            <Link href="/login" className="text-primary inline-block text-sm font-semibold hover:underline">
              Aller à la connexion
            </Link>
          </div>
        ) : (
          <form action={formAction} className="border-border bg-surface space-y-4 rounded-xl border p-6 shadow-sm">
            <div className="space-y-1.5">
              <label htmlFor="nom" className="text-sm font-medium">Nom</label>
              <input id="nom" name="nom" type="text" autoComplete="name" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">Mot de passe</label>
              <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
              <p className="text-muted-foreground text-xs">8 caractères minimum.</p>
            </div>

            {error && <p className="text-danger text-sm">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="bg-primary text-primary-foreground inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Création…" : "Créer mon compte"}
            </button>

            <p className="text-muted-foreground text-center text-sm">
              Déjà un compte ?{" "}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Se connecter
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
