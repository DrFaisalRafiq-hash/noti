import { useCallback, useEffect, useState } from "react";
import {
  ensureServiceWorker,
  ensurePushSubscription,
  disablePushSubscription,
  isIOS,
  isStandalone,
  notificationsSupported,
} from "@/lib/notifications";

const ENABLED_KEY = "noti-notifications-enabled";
const EVENT = "noti:notifications-changed";

export type NotificationStatus =
  | "unsupported"
  | "needs-install" // iOS Safari, not installed
  | "denied"
  | "default" // permission not yet asked
  | "granted-disabled" // permission granted but user toggled off in app
  | "granted-enabled";

export function useNotificationsPreference() {
  const [enabledPref, setEnabledPref] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ENABLED_KEY) === "1";
  });
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });

  useEffect(() => {
    const onChange = () => {
      const v = localStorage.getItem(ENABLED_KEY) === "1";
      setEnabledPref(v);
      if ("Notification" in window) setPermission(Notification.permission);
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setPref = useCallback((v: boolean) => {
    try {
      localStorage.setItem(ENABLED_KEY, v ? "1" : "0");
      window.dispatchEvent(new Event(EVENT));
    } catch {}
    setEnabledPref(v);
  }, []);

  const status: NotificationStatus = (() => {
    if (!notificationsSupported()) {
      // iOS Safari only exposes Notification API once installed as PWA.
      if (isIOS() && !isStandalone()) return "needs-install";
      return "unsupported";
    }
    if (permission === "denied") return "denied";
    if (permission === "default") return "default";
    return enabledPref ? "granted-enabled" : "granted-disabled";
  })();

  const enable = useCallback(async () => {
    if (!notificationsSupported()) return false;
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }
    if (perm !== "granted") return false;
    await ensureServiceWorker();
    // Register a Web Push subscription so the server-side dispatcher can
    // deliver due-time notifications. Best-effort: a missing VAPID key on
    // the server won't block local-only fallbacks.
    void ensurePushSubscription();
    setPref(true);
    return true;
  }, [setPref]);

  const disable = useCallback(() => {
    void disablePushSubscription();
    setPref(false);
  }, [setPref]);

  return {
    status,
    enabled: status === "granted-enabled",
    permission,
    enable,
    disable,
  };
}
