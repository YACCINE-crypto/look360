"use client";

import { createContext, useContext } from "react";

// Fournit l'offre courante aux composants clients (ex. boutons de
// téléchargement) pour afficher les cadenas premium. Le contrôle réel reste
// CÔTÉ SERVEUR (routes/actions) — ceci n'est que l'UX.
const PlanContext = createContext<string>("free");

export function PlanProvider({
  plan,
  children,
}: {
  plan: string;
  children: React.ReactNode;
}) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}

export function usePlan(): string {
  return useContext(PlanContext);
}

/** Le téléchargement des vidéos est réservé aux offres payantes (Starter+). */
export function useCanDownload(): boolean {
  return useContext(PlanContext) !== "free";
}
