"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

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

type State = "unsupported" | "default" | "granted" | "denied" | "loading";

export function NotifBell() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(supported ? (Notification.permission as State) : "unsupported");
  }, []);

  async function enable() {
    try {
      setState("loading");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm as State);
        return;
      }
      const ready = await navigator.serviceWorker.ready.catch(() => reg);
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("VAPID public key manquante");

      const existing = await ready.pushManager.getSubscription();
      const sub =
        existing ??
        (await ready.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBuffer(key),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState("granted");
    } catch {
      setState("default");
    }
  }

  if (state === "unsupported") return null;

  if (state === "granted") {
    return (
      <div className="text-muted-foreground flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
        <Icon name="bell" size={16} />
        Notifications activées
      </div>
    );
  }

  const denied = state === "denied";

  return (
    <button
      type="button"
      onClick={enable}
      disabled={state === "loading" || denied}
      title={denied ? "Notifications bloquées dans le navigateur" : undefined}
      className="text-muted-foreground hover:bg-input hover:text-foreground flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors disabled:opacity-60"
    >
      <Icon name={denied ? "bellOff" : "bell"} size={16} />
      {state === "loading"
        ? "…"
        : denied
          ? "Notifs bloquées"
          : "Activer les notifications"}
    </button>
  );
}
