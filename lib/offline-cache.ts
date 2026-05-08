import type { Folder, Note } from "./notes-store";

/**
 * Lightweight offline cache for the notes workspace.
 *
 * Strategy: snapshot every successful fetch into localStorage (one blob per
 * device id). On cold start the store hydrates synchronously from the
 * snapshot so the UI is usable instantly — even with no network. Network
 * fetches then refresh the snapshot in the background.
 *
 * We deliberately avoid IndexedDB here: payloads are well under the ~5 MB
 * localStorage budget for a personal note workspace, and synchronous
 * hydration removes a flash of empty state.
 */

const CACHE_VERSION = 1;
const KEY = (dev: string) => `noti-offline-cache:v${CACHE_VERSION}:${dev}`;

export interface OfflineSnapshot {
  folders: Folder[];
  notes: Note[];
  savedAt: string;
}

export function readSnapshot(dev: string): OfflineSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY(dev));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineSnapshot;
    if (!parsed || !Array.isArray(parsed.notes) || !Array.isArray(parsed.folders)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSnapshot(dev: string, folders: Folder[], notes: Note[]) {
  try {
    const snap: OfflineSnapshot = {
      folders,
      notes,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY(dev), JSON.stringify(snap));
  } catch {
    // Quota exceeded or storage disabled — fail quietly.
  }
}

export function clearSnapshot(dev: string) {
  try {
    localStorage.removeItem(KEY(dev));
  } catch {
    // ignore
  }
}
