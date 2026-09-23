"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { resetPassword } from "./actions";

export default function ResetPasswordPage() {
  const [error, formAction, pending] = useActionState(resetPassword, null);

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/look360-logo.svg" alt="Look360" className="mb-3 h-12 w-auto" />
          <p className="text-muted-foreground text-sm">Nouveau mot de passe</p>
        </div>

        <form action={formAction} className="border-border bg-surface space-y-4 rounded-xl border p-6 shadow-sm">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">Nouveau mot de passe</label>
            <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">Confirme le mot de passe</label>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Mettre à jour"}
          </button>
        </form>
      </div>
    </main>
  );
}
