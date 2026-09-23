"use client";

import Link from "next/link";
import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PasswordInput } from "@/components/PasswordInput";
import { login } from "./actions";
import { signup } from "@/app/signup/actions";

const fieldCls =
  "border-border bg-input focus:border-primary w-full min-h-[46px] rounded-lg border px-3 py-2 text-sm outline-none transition-colors";
const labelCls = "text-sm font-medium";
const pill =
  "bg-primary text-primary-foreground inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthCard />
    </Suspense>
  );
}

function AuthCard() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"login" | "signup">("login");

  const [loginError, loginAction, loginPending] = useActionState(login, null);
  const [signupError, signupAction, signupPending] = useActionState(signup, null);

  const reset = params.get("reset") === "1";
  const authError = params.get("error") === "auth";

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo + sous-titre */}
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/look360-logo.svg" alt="Look360" className="mb-3 h-12 w-auto" />
          <p className="text-muted-foreground text-sm">
            Recherche &amp; testing produit COD
          </p>
        </div>

        <div className="border-border bg-surface rounded-2xl border p-6 shadow-lg">
          {/* Onglets */}
          <div role="tablist" className="border-border mb-5 grid grid-cols-2 border-b">
            <TabButton active={tab === "login"} onClick={() => setTab("login")}>
              Connexion
            </TabButton>
            <TabButton active={tab === "signup"} onClick={() => setTab("signup")}>
              Inscription
            </TabButton>
          </div>

          {reset && (
            <div className="bg-success-bg text-success mb-4 rounded-lg p-3 text-sm">
              Mot de passe mis à jour. Connecte-toi.
            </div>
          )}
          {authError && (
            <div className="bg-danger-bg text-danger mb-4 rounded-lg p-3 text-sm">
              Lien invalide ou expiré. Réessaie de te connecter ou de réinitialiser.
            </div>
          )}

          {tab === "login" ? (
            <form action={loginAction} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className={labelCls}>Adresse email</label>
                <input id="login-email" name="email" type="email" autoComplete="email" required placeholder="toi@exemple.com" className={fieldCls} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className={labelCls}>Mot de passe</label>
                  <Link href="/forgot-password" className="text-primary text-xs font-medium hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <PasswordInput id="login-password" name="password" autoComplete="current-password" />
              </div>

              {loginError && <p className="text-danger text-sm">{loginError}</p>}

              <button type="submit" disabled={loginPending} className={pill}>
                {loginPending ? "Connexion…" : "Se connecter"}
              </button>
            </form>
          ) : (
            <form action={signupAction} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="signup-nom" className={labelCls}>Nom</label>
                <input id="signup-nom" name="nom" type="text" autoComplete="name" placeholder="Ton nom" className={fieldCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="signup-email" className={labelCls}>Adresse email</label>
                <input id="signup-email" name="email" type="email" autoComplete="email" required placeholder="toi@exemple.com" className={fieldCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="signup-password" className={labelCls}>Mot de passe</label>
                <PasswordInput id="signup-password" name="password" autoComplete="new-password" minLength={8} />
                <p className="text-muted-foreground text-xs">8 caractères minimum.</p>
              </div>

              {signupError && <p className="text-danger text-sm">{signupError}</p>}

              <button type="submit" disabled={signupPending} className={pill}>
                {signupPending ? "Création…" : "Créer un compte"}
              </button>
            </form>
          )}
        </div>

        <p className="text-muted-foreground mt-4 flex items-center justify-center gap-1.5 text-center text-xs">
          <Icon name="check" size={13} className="text-success" />
          Isolation des comptes garantie — tes données restent privées.
        </p>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      onClick={onClick}
      aria-selected={active}
      className={`-mb-px border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors ${
        active
          ? "border-primary text-primary"
          : "text-muted-foreground hover:text-foreground border-transparent"
      }`}
    >
      {children}
    </button>
  );
}
