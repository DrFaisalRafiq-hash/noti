// Service worker registration + notification helpers.
// Production-only: skipped in iframes / Lovable preview hosts to avoid the
// known caching issues called out in the PWA guidance.

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

export const SW_ENABLED = !isInIframe && !isPreviewHost;

let swRegistration: ServiceWorkerRegistration | null = null;
let swReady: Promise<ServiceWorkerRegistration | null> | null = null;

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  // Always clean up any registered SW in preview/iframe contexts so stale
  // workers don't poison the editor.
  if (!SW_ENABLED) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((r) => r.unregister());
    } catch {}
    return null;
  }

  if (swRegistration) return swRegistration;
  if (swReady) return swReady;

  swReady = (async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      swRegistration = reg;
      return reg;
    } catch (err) {
      console.warn("[noti] SW registration failed", err);
      return null;
    }
  })();

  return swReady;
}

export type NotiNotificationOptions = {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
  noteId?: string;
};

/** Show a notification right now. Uses the SW when available so it works
 *  even after the user has switched tabs. Falls back to a window-level
 *  Notification on desktop browsers without SW. */
export async function showNotificationNow(opts: NotiNotificationOptions) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const reg = await ensureServiceWorker();
  const payload = {
    body: opts.body,
    tag: opts.tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: opts.url ?? "/", noteId: opts.noteId },
  };

  if (reg) {
    try {
      await reg.showNotification(opts.title, payload);
      return;
    } catch (err) {
      console.warn("[noti] SW showNotification failed", err);
    }
  }

  try {
    new Notification(opts.title, payload);
  } catch {}
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone; everywhere else uses display-mode.
  // @ts-expect-error - iOS-only property
  if (window.navigator.standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

// ---------------------------------------------------------------------------
// Web Push subscription
// ---------------------------------------------------------------------------
// Registers the device with the browser push service using our VAPID public
// key (fetched from the push-subscribe edge function), then stores the
// subscription server-side so the per-minute dispatcher can deliver pushes.

import { supabase } from "@/integrations/supabase/client";
import { deviceId } from "@/lib/notes-store";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let cachedVapid: string | null = null;
async function fetchVapidPublicKey(): Promise<string | null> {
  if (cachedVapid) return cachedVapid;
  try {
    const { data, error } = await supabase.functions.invoke("push-subscribe", {
      method: "GET",
    });
    if (error) throw error;
    const key = (data as { vapid_public_key?: string | null })?.vapid_public_key ?? null;
    cachedVapid = key;
    return key;
  } catch (err) {
    console.warn("[noti] failed to fetch VAPID key", err);
    return null;
  }
}

/** Registers a Web Push subscription for this device. Returns true on success. */
export async function ensurePushSubscription(opts?: { strongAlerts?: boolean }): Promise<boolean> {
  if (!SW_ENABLED) return false;
  const reg = await ensureServiceWorker();
  if (!reg || !("pushManager" in reg)) return false;

  const vapid = await fetchVapidPublicKey();
  if (!vapid) {
    console.warn("[noti] no VAPID public key configured on server");
    return false;
  }

  // Reuse existing browser subscription if present; otherwise create one.
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid).buffer as ArrayBuffer,
      });
    } catch (err) {
      console.warn("[noti] pushManager.subscribe failed", err);
      return false;
    }
  }

  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  try {
    const strong = localStorage.getItem("noti-strong-alerts");
    const strongAlerts =
      opts?.strongAlerts ?? (strong === null ? true : strong === "1");
    await supabase.functions.invoke("push-subscribe", {
      body: {
        action: "subscribe",
        device_id: deviceId(),
        subscription: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
        user_agent: navigator.userAgent,
        strong_alerts: strongAlerts,
      },
    });
    return true;
  } catch (err) {
    console.warn("[noti] push-subscribe upsert failed", err);
    return false;
  }
}

/** Unregisters this device server-side (keeps browser subscription intact). */
export async function disablePushSubscription(): Promise<void> {
  try {
    await supabase.functions.invoke("push-subscribe", {
      body: { action: "unsubscribe", device_id: deviceId() },
    });
  } catch {}
}

