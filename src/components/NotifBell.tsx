"use client";

import { useEffect, useState } from "react";

/** base64url (clé VAPID publique) -> BufferSource pour PushManager. */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

type State = "unsupported" | "loading" | "on" | "off" | "denied";

/**
 * Interrupteur « Alertes push » pour CET appareil : activer = permission +
 * abonnement enregistré ; désactiver = désabonnement (navigateur + base).
 */
export function NotifBell() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return "unsupported" as const;
      if (Notification.permission === "denied") return "denied" as const;
      if (Notification.permission !== "granted") return "off" as const;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      return sub ? ("on" as const) : ("off" as const);
    })()
      .catch(() => "off" as const)
      .then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setState(perm === "denied" ? "denied" : "off");
      return;
    }
    const ready = await navigator.serviceWorker.ready.catch(() => reg);
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) throw new Error("VAPID public key manquante");
    const sub =
      (await ready.pushManager.getSubscription()) ??
      (await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBuffer(key) }));
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
    if (!res.ok) throw new Error("subscribe failed");
    setState("on");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);
      await sub.unsubscribe().catch(() => undefined);
    }
    setState("off");
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const was = state;
    try {
      if (state === "on") await disable();
      else await enable();
    } catch {
      setState(was);
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") {
    return <span className="text-muted-foreground text-sm">Non disponible sur ce navigateur</span>;
  }
  if (state === "denied") {
    return (
      <span className="text-muted-foreground max-w-48 text-right text-xs">
        Bloquées dans le navigateur : autorise-les dans les réglages du site.
      </span>
    );
  }

  const on = state === "on";
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground hidden text-sm sm:inline">{state === "loading" ? "…" : on ? "Activées" : "Désactivées"}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Alertes push sur cet appareil"
        disabled={busy || state === "loading"}
        onClick={toggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 ${
          on ? "bg-accent" : "bg-input"
        }`}
      >
        <span
          className={`bg-surface inline-block h-5 w-5 transform rounded-full shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}
