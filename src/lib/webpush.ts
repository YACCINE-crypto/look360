import "server-only";
import webpush from "web-push";

let configured = false;

/** Configure web-push avec les clés VAPID (une fois). */
export function getWebPush() {
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@look360.app",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return webpush;
}

export type PushKeys = { p256dh: string; auth: string };
export type StoredSubscription = {
  endpoint: string;
  keys: PushKeys;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};
