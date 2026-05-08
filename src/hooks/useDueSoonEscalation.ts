// ============================================================================
// useDueSoonEscalation
// ----------------------------------------------------------------------------
// User preference: should reminders/meetings whose remind_at is within the
// next hour automatically borrow the High/Critical visual emphasis on note
// cards and list rows? Default: ON.
//
// Persisted to localStorage so the choice survives reloads, and broadcast
// across components in the same tab via a custom event so toggling in
// Settings updates note cards live (the native `storage` event only fires
// across tabs).
// ============================================================================
import { useEffect, useState } from "react";

const KEY = "noti-due-soon-emphasis";
const EVENT = "noti:due-soon-emphasis-changed";

function read(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(KEY);
  // Default ON unless the user explicitly disabled it.
  return raw === null ? true : raw === "1";
}

export function getDueSoonEscalationEnabled(): boolean {
  return read();
}

export function setDueSoonEscalationEnabled(enabled: boolean) {
  try {
    localStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {}
  // Notify same-tab listeners; cross-tab updates ride the native `storage` event.
  window.dispatchEvent(new CustomEvent(EVENT, { detail: enabled }));
}

/**
 * Subscribe to the preference. Re-renders the calling component whenever the
 * value changes (in this tab via custom event, across tabs via `storage`).
 */
export function useDueSoonEscalation(): boolean {
  const [enabled, setEnabled] = useState<boolean>(read);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setEnabled(detail);
      else setEnabled(read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setEnabled(read());
    };
    window.addEventListener(EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return enabled;
}
