"use client";

import Link from "next/link";
import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Turnstile } from "@/components/Turnstile";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthInput, AuthPasswordWrap, AuthShell } from "@/components/auth/AuthShell";
import { login } from "./actions";
import { signup } from "@/app/signup/actions";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthCard />
    </Suspense>
  );
}

/** Connexion et inscription (même page, bascule en bas), habillage « Nuit ». */
function AuthCard() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"login" | "signup">(params.get("tab") === "signup" ? "signup" : "login");
  const [loginError, loginAction, loginPending] = useActionState(login, null);
  const [signupError, signupAction, signupPending] = useActionState(signup, null);

  const reset = params.get("reset") === "1";
  const authError = params.get("error") === "auth";
  const sent = params.get("sent") === "1";

  const go = (t: "login" | "signup") => {
    setTab(t);
    try {
      window.history.replaceState(null, "", t === "signup" ? "/login?tab=signup" : "/login");
    } catch {
      /* ignore */
    }
  };

  // Après inscription (confirmation e-mail activée) : « vérifie ta boîte mail ».
  if (sent) {
    return (
      <AuthShell>
        <p className="auth-eyebrow">Presque fini</p>
        <h1 className="auth-title">Vérifie ta boîte mail</h1>
        <p className="auth-sub">
          On t&apos;a envoyé un lien de confirmation. Clique dessus pour activer ton compte Gratuit, puis connecte-toi.
        </p>
        <div className="auth-form">
          <Link href="/login" className="auth-btn">
            Aller à la connexion
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {tab === "login" ? (
        <>
          <p className="auth-eyebrow">Bon retour</p>
          <h1 className="auth-title">Connecte-toi</h1>
          <p className="auth-sub">Retrouve tes recherches, tes tests et tes concurrents suivis.</p>

          {reset && <p className="auth-msg ok">Mot de passe mis à jour. Connecte-toi.</p>}
          {authError && <p className="auth-msg err">Lien invalide ou expiré. Réessaie de te connecter ou de réinitialiser.</p>}

          <form action={loginAction} className="auth-form">
            <div className="auth-field">
              <label htmlFor="login-email" className="auth-label">
                Adresse e-mail
              </label>
              <AuthInput icon="mail" id="login-email" name="email" type="email" autoComplete="email" required placeholder="toi@exemple.com" />
            </div>
            <div className="auth-field">
              <div className="auth-label">
                <label htmlFor="login-password">Mot de passe</label>
                <Link href="/forgot-password">Mot de passe oublié ?</Link>
              </div>
              <AuthPasswordWrap>
                <PasswordInput id="login-password" name="password" autoComplete="current-password" placeholder="Ton mot de passe" />
              </AuthPasswordWrap>
            </div>

            {loginError && <p className="auth-msg err" role="alert">{loginError}</p>}

            <button type="submit" disabled={loginPending} className="auth-btn">
              {loginPending ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="auth-switch">
            Pas encore de compte ?{" "}
            <button type="button" onClick={() => go("signup")}>
              Créer un compte
            </button>
          </p>
        </>
      ) : (
        <>
          <p className="auth-eyebrow">C&apos;est parti</p>
          <h1 className="auth-title">Crée ton compte</h1>
          <p className="auth-sub">Gratuit, sans carte bancaire. On t&apos;envoie un lien pour confirmer ton adresse e-mail.</p>

          <form action={signupAction} className="auth-form">
            <div className="auth-field">
              <label htmlFor="signup-nom" className="auth-label">
                Nom
              </label>
              <AuthInput icon="user" id="signup-nom" name="nom" type="text" autoComplete="name" placeholder="Ton nom" />
            </div>
            <div className="auth-field">
              <label htmlFor="signup-email" className="auth-label">
                Adresse e-mail
              </label>
              <AuthInput icon="mail" id="signup-email" name="email" type="email" autoComplete="email" required placeholder="toi@exemple.com" />
            </div>
            <div className="auth-field">
              <label htmlFor="signup-password" className="auth-label">
                Mot de passe
              </label>
              <AuthPasswordWrap>
                <PasswordInput
                  id="signup-password"
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="8 caractères minimum"
                />
              </AuthPasswordWrap>
            </div>

            <Turnstile theme="dark" />

            {signupError && <p className="auth-msg err" role="alert">{signupError}</p>}

            <button type="submit" disabled={signupPending} className="auth-btn">
              {signupPending ? "Création…" : "Créer mon compte"}
            </button>
          </form>

          <p className="auth-switch">
            Tu as déjà un compte ?{" "}
            <button type="button" onClick={() => go("login")}>
              Se connecter
            </button>
          </p>
        </>
      )}
    </AuthShell>
  );
}
