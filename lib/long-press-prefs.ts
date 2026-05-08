/**
 * User-tunable preferences for the long-press → action sheet gesture.
 *
 * The defaults match Apple's Human Interface Guidelines for "press":
 *  - 400 ms hold
 *  - 8 px movement slop before the gesture is abandoned
 *
 * Persisted to localStorage so a user's choice (e.g. "I want a faster
 * long-press") sticks across sessions and pages. Subscribers re-render
 * via `useLongPressPrefs()` whenever the values change.
 */

export interface LongPressPrefs {
  /** Hold duration in milliseconds before the action sheet opens. */
  durationMs: number;
  /** Pixels of finger travel that cancel the press before it fires. */
  slopPx: number;
}

export const LONG_PRESS_DEFAULTS: LongPressPrefs = {
  durationMs: 400,
  slopPx: 8,
};

export const LONG_PRESS_BOUNDS = {
  durationMs: { min: 150, max: 900 },
  slopPx: { min: 4, max: 24 },
};

const STORAGE_KEY = "noti.longPress.prefs.v1";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

function load(): LongPressPrefs {
  if (typeof window === "undefined") return { ...LONG_PRESS_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...LONG_PRESS_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<LongPressPrefs>;
    return {
      durationMs: clamp(
        Number(parsed.durationMs) || LONG_PRESS_DEFAULTS.durationMs,
        LONG_PRESS_BOUNDS.durationMs.min,
        LONG_PRESS_BOUNDS.durationMs.max,
      ),
      slopPx: clamp(
        Number(parsed.slopPx) || LONG_PRESS_DEFAULTS.slopPx,
        LONG_PRESS_BOUNDS.slopPx.min,
        LONG_PRESS_BOUNDS.slopPx.max,
      ),
    };
  } catch {
    return { ...LONG_PRESS_DEFAULTS };
  }
}

let current: LongPressPrefs = load();
const listeners = new Set<(p: LongPressPrefs) => void>();

export function getLongPressPrefs(): LongPressPrefs {
  return current;
}

export function setLongPressPrefs(patch: Partial<LongPressPrefs>): LongPressPrefs {
  const next: LongPressPrefs = {
    durationMs: clamp(
      patch.durationMs ?? current.durationMs,
      LONG_PRESS_BOUNDS.durationMs.min,
      LONG_PRESS_BOUNDS.durationMs.max,
    ),
    slopPx: clamp(
      patch.slopPx ?? current.slopPx,
      LONG_PRESS_BOUNDS.slopPx.min,
      LONG_PRESS_BOUNDS.slopPx.max,
    ),
  };
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode etc. — fall back to in-memory only */
  }
  listeners.forEach((fn) => fn(next));
  return next;
}

export function resetLongPressPrefs(): LongPressPrefs {
  return setLongPressPrefs(LONG_PRESS_DEFAULTS);
}

export function subscribeLongPressPrefs(fn: (p: LongPressPrefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Cross-tab sync: pick up changes made in other tabs/windows.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    current = load();
    listeners.forEach((fn) => fn(current));
  });
}
