"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthPasswordWrap, AuthShell } from "@/components/auth/AuthShell";
import { resetPassword } from "./actions";

export default function ResetPasswordPage() {
  const [error, formAction, pending] = useActionState(resetPassword, null);

  return (
    <AuthShell>
      <p className="auth-eyebrow">Dernière étape</p>
      <h1 className="auth-title">Nouveau mot de passe</h1>
      <p className="auth-sub">Choisis un mot de passe d&apos;au moins 8 caractères.</p>
      <form action={formAction} className="auth-form">
        <div className="auth-field">
          <label htmlFor="password" className="auth-label">
            Nouveau mot de passe
          </label>
          <AuthPasswordWrap>
            <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} placeholder="8 caractères minimum" />
          </AuthPasswordWrap>
        </div>
        <div className="auth-field">
          <label htmlFor="confirm" className="auth-label">
            Confirme le mot de passe
          </label>
          <AuthPasswordWrap>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} placeholder="Le même, une seconde fois" />
          </AuthPasswordWrap>
        </div>
        {error && <p className="auth-msg err" role="alert">{error}</p>}
        <button type="submit" disabled={pending} className="auth-btn">
          {pending ? "Enregistrement…" : "Mettre à jour"}
        </button>
      </form>
    </AuthShell>
  );
}
