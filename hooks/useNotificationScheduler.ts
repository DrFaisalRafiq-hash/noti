import { useEffect } from "react";
import type { Note } from "@/lib/notes-store";
import { showNotificationNow, ensureServiceWorker, notificationsSupported } from "@/lib/notifications";

const FIRED_KEY = "noti-fired-notifications";
const DUE_SOON_LEAD_MS = 10 * 60 * 1000; // 10 minutes
// We won't schedule events further than this in the future — covers a normal
// session window without holding hundreds of timers open. Anything farther
// out gets picked up the next time the app loads.
const MAX_SCHEDULE_AHEAD_MS = 24 * 60 * 60 * 1000; // 24h

type FiredMap = Record<string, true>;

function loadFired(): FiredMap {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveFired(map: FiredMap) {
  try {
    // Trim to last 500 entries to stop the list growing forever.
    const keys = Object.keys(map);
    if (keys.length > 500) {
      const trimmed: FiredMap = {};
      keys.slice(-500).forEach((k) => (trimmed[k] = true));
      map = trimmed;
    }
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {
  }
}

function noteUrl() {
  return "/";
}

function noteTitle(n: Note) {
  return n.title?.trim() || n.text.trim().split("\n")[0].slice(0, 80) || "Untitled";
}

function bodyForDue(n: Note) {
  if (n.mode === "meeting") return "Meeting starting now";
  if (n.mode === "reminder") return "Reminder is due";
  return "Due now";
}
function bodyForSoon(n: Note, minutes: number) {
  const label = n.mode === "meeting" ? "Meeting" : "Reminder";
  return `${label} in ${minutes} min`;
}

/**
 * Schedules local notifications for any reminder/meeting note with a
 * future remind_at. Reschedules whenever notes change. Already-fired
 * timestamps are remembered in localStorage so we don't re-notify after
 * a reload.
 */
export function useNotificationScheduler(notes: Note[], enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!notificationsSupported()) return;
    if (Notification.permission !== "granted") return;

    // Make sure the SW is registered so notifications keep working when the
    // tab is backgrounded.
    ensureServiceWorker();

    const fired = loadFired();
    const timers: number[] = [];
    const now = Date.now();

    const scheduleAt = (key: string, when: number, run: () => void) => {
      if (fired[key]) return;
      const delay = when - now;
      if (delay <= 0) {
        // Already past — only fire if it slipped within the last 5 minutes
        // to avoid spamming notifications for old, missed reminders.
        if (delay > -5 * 60 * 1000) {
          run();
          fired[key] = true;
          saveFired(fired);
        } else {
          fired[key] = true;
          saveFired(fired);
        }
        return;
      }
      if (delay > MAX_SCHEDULE_AHEAD_MS) return;
      const id = window.setTimeout(() => {
        run();
        fired[key] = true;
        saveFired(fired);
      }, delay);
      timers.push(id);
    };

    notes.forEach((n) => {
      if (n.deleted_at || n.archived || n.fired || n.done) return;
      if (n.mode !== "reminder" && n.mode !== "meeting") return;
      if (!n.remind_at) return;
      const due = new Date(n.remind_at).getTime();
      if (Number.isNaN(due)) return;

      const dueKey = `${n.id}|${due}|due`;
      const soonKey = `${n.id}|${due}|soon`;

      scheduleAt(soonKey, due - DUE_SOON_LEAD_MS, () =>
        showNotificationNow({
          title: noteTitle(n),
          body: bodyForSoon(n, 10),
          tag: soonKey,
          url: noteUrl(),
          noteId: n.id,
        })
      );

      scheduleAt(dueKey, due, () =>
        showNotificationNow({
          title: noteTitle(n),
          body: bodyForDue(n),
          tag: dueKey,
          url: noteUrl(),
          noteId: n.id,
        })
      );
    });

    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, [notes, enabled]);
}
