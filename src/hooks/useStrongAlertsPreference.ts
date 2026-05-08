import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deviceId } from "@/lib/notes-store";

// "Stronger alerts" controls whether High/Critical priority notes get
// heightened push behavior (require-interaction, vibration, urgent prefix).
// Default: on. Mirrored to the server-side push_subscriptions row so the
// dispatcher knows whether to escalate.
const KEY = "noti-strong-alerts";
const EVENT = "noti:strong-alerts-changed";

function read(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(KEY);
  return raw === null ? true : raw === "1";
}

export function useStrongAlertsPreference() {
  const [enabled, setEnabled] = useState<boolean>(read);

  useEffect(() => {
    const onChange = () => setEnabled(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setPref = useCallback(async (v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
      window.dispatchEvent(new Event(EVENT));
    } catch {}
    setEnabled(v);
    // Best-effort sync to the server so the dispatcher honors the new
    // preference for this device. Safe to ignore errors — the next
    // subscribe call will resend the flag.
    try {
      await supabase.functions.invoke("push-subscribe", {
        body: { action: "set_prefs", device_id: deviceId(), strong_alerts: v },
      });
    } catch {}
  }, []);

  return { enabled, setPref };
}
