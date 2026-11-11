"use client";

import { useEffect } from "react";

/** Lien ?ref=CODE : enregistre le clic (cookie signé côté serveur) puis nettoie l'URL. */
export function RefTracker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("ref");
    if (!code || !/^[A-Za-z0-9]{6,12}$/.test(code)) return;
    fetch("/api/ref/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => {});
    url.searchParams.delete("ref");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}

/** Une fois connecté : rattache le compte au parrain (une seule fois, règles en base). */
export function RefClaim() {
  useEffect(() => {
    fetch("/api/ref/claim", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
