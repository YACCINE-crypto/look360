"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/**
 * Champ mot de passe avec bascule afficher/masquer (icône œil / œil barré).
 * Réutilisé partout (connexion, inscription, réinitialisation).
 */
export function PasswordInput({
  id,
  name = "password",
  placeholder = "••••••••",
  autoComplete = "current-password",
  required = true,
  minLength,
}: {
  id?: string;
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="border-border bg-input focus:border-primary w-full min-h-[46px] rounded-lg border px-3 py-2 pr-11 text-sm outline-none transition-colors"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={show}
        className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md"
      >
        <Icon name={show ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}
