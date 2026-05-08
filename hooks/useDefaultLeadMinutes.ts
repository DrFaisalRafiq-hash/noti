import { useCallback, useEffect, useState } from "react";

// Global default heads-up window for new reminders/meetings.
// Values: null (off), 10, or 30 minutes. Persisted to localStorage so the
// preference survives reloads. New notes inherit this value at creation
// time; per-note overrides are saved on the note itself.
export type LeadMinutes = null | 10 | 30;

const KEY = "noti-default-lead-minutes";
const EVENT = "noti:default-lead-changed";

function read(): LeadMinutes {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (raw === "10") return 10;
  if (raw === "30") return 30;
  return null;
}

export function useDefaultLeadMinutes() {
  const [value, setValue] = useState<LeadMinutes>(read);

  useEffect(() => {
    const onChange = () => setValue(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setPref = useCallback((v: LeadMinutes) => {
    try {
      if (v === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(v));
      window.dispatchEvent(new Event(EVENT));
    } catch {}
    setValue(v);
  }, []);

  return { value, setPref };
}

/** One-shot read for non-React callers (e.g., creating a note). */
export function getDefaultLeadMinutes(): LeadMinutes {
  return read();
}
