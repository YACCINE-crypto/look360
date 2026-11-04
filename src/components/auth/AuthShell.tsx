import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import "./auth.css";

/** Cadre des pages compte : en-tête logo, contenu centré, mention de confiance. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <header className="auth-head">
        <Link href="/" aria-label="Look360 — accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/look360-logo-light.svg" alt="Look360" width={133} height={36} />
        </Link>
      </header>
      <main className="auth-main">
        <div className="auth-box">
          {children}
          <p className="auth-trust">
            <Icon name="check" size={14} strokeWidth={3} />
            Isolation des comptes garantie : tes données restent privées.
          </p>
        </div>
      </main>
    </div>
  );
}

/** Champ avec icône à gauche (email, nom…). */
export function AuthInput({ icon, ...props }: { icon: "mail" | "user" } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="auth-input">
      <Icon name={icon} size={18} className="ic" />
      <input {...props} />
    </div>
  );
}

/** Champ mot de passe avec icône cadenas (le bouton œil vient de PasswordInput). */
export function AuthPasswordWrap({ children }: { children: ReactNode }) {
  return (
    <div className="auth-input">
      <Icon name="lock" size={18} className="ic" />
      {children}
    </div>
  );
}
