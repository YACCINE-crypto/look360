"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthInput, AuthShell } from "@/components/auth/AuthShell";
import { forgotPassword } from "./actions";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const [error, formAction, pending] = useActionState(forgotPassword, null);
  const sent = useSearchParams().get("sent") === "1";

  return (
    <AuthShell>
      <p className="auth-eyebrow">Pas de panique</p>
      <h1 className="auth-title">Mot de passe oublié</h1>
      {sent ? (
        <>
          <p className="auth-sub">
            Si un compte existe avec cette adresse, tu vas recevoir un lien pour choisir un nouveau mot de passe.
          </p>
          <div className="auth-form">
            <Link href="/login" className="auth-btn">
              Retour à la connexion
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="auth-sub">Entre ton adresse e-mail : on t&apos;envoie un lien pour choisir un nouveau mot de passe.</p>
          <form action={formAction} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">
                Adresse e-mail
              </label>
              <AuthInput icon="mail" id="email" name="email" type="email" autoComplete="email" required placeholder="toi@exemple.com" />
            </div>
            {error && <p className="auth-msg err" role="alert">{error}</p>}
            <button type="submit" disabled={pending} className="auth-btn">
              {pending ? "Envoi…" : "Envoyer le lien"}
            </button>
          </form>
          <p className="auth-switch">
            <Link href="/login">Retour à la connexion</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
