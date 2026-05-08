// ============================================================================
// Script version snapshots
// ----------------------------------------------------------------------------
// Per-script snapshot history kept in localStorage. Each editor instance is
// scoped by a `historyKey` (note id, or a stable anonymous draft id). We push
// a snapshot before every meaningful mutation (AI generate / compile /
// regenerate, template apply, paste import) and a debounced one after manual
// edits, so users can roll back to any earlier state.
// ============================================================================

import { parseScript } from "./podcast-script";

export type SnapshotReason =
  | "manual"
  | "ai-compose"
  | "ai-compile"
  | "ai-regenerate"
  | "template"
  | "paste-import"
  | "outline-import"
  | "pace"
  | "pre-restore";

/** Optional release status a user can pin onto a snapshot so it can be
 *  surfaced separately (e.g. only share "published" or "final" versions). */
export type SnapshotStatus = "published" | "final";

export interface ScriptSnapshot {
  id: string;
  /** ms since epoch */
  at: number;
  reason: SnapshotReason;
  summary: ScriptSummary;
  /** Same string the editor writes via onChange(). */
  serialized: string;
  /** User-applied release marker. Absent = working/draft snapshot. */
  status?: SnapshotStatus;
}

export interface ScriptSummary {
  kind: "podcast" | "screenplay";
  format: string;
  segmentCount: number;
  totalSec: number;
  topic: string;
}

const PREFIX = "noti.script.history.v1.";
const MAX_ENTRIES = 30;

function storageKey(scope: string) {
  return `${PREFIX}${scope}`;
}

function newId() {
  // Browser-safe uuid-ish — only used as a list key
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export function loadHistory(scope: string): ScriptSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as ScriptSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(scope: string, list: ScriptSnapshot[]) {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(list));
  } catch {
    /* quota exceeded — best effort, drop silently */
  }
}

export function clearHistory(scope: string) {
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    /* ignore */
  }
}

export function summarizeScript(serialized: string): ScriptSummary {
  const parsed = parseScript(serialized);
  if (!parsed) {
    return { kind: "podcast", format: "segmented", segmentCount: 0, totalSec: 0, topic: "" };
  }
  const totalSec = parsed.segments.reduce((s, seg) => s + (seg.durationSec || 0), 0);
  return {
    kind: (parsed.kind ?? "podcast") as "podcast" | "screenplay",
    format: parsed.format,
    segmentCount: parsed.segments.length,
    totalSec,
    topic: parsed.brief?.topic ?? "",
  };
}

/** Append a snapshot, dedupe against the most recent identical serialized form,
 *  and cap to MAX_ENTRIES newest. Returns the new list. */
export function pushSnapshot(
  scope: string,
  reason: SnapshotReason,
  serialized: string
): ScriptSnapshot[] {
  // Skip empty drafts entirely.
  if (!serialized || !serialized.trim()) return loadHistory(scope);
  const list = loadHistory(scope);
  const last = list[0];
  if (last && last.serialized === serialized) return list;
  const entry: ScriptSnapshot = {
    id: newId(),
    at: Date.now(),
    reason,
    summary: summarizeScript(serialized),
    serialized,
  };
  const next = [entry, ...list].slice(0, MAX_ENTRIES);
  saveHistory(scope, next);
  return next;
}

export function deleteSnapshot(scope: string, id: string): ScriptSnapshot[] {
  const next = loadHistory(scope).filter((s) => s.id !== id);
  saveHistory(scope, next);
  return next;
}

/** Mark or unmark a snapshot with a release status (`published` / `final`).
 *  Pass `null` to clear. Returns the updated list. */
export function setSnapshotStatus(
  scope: string,
  id: string,
  status: SnapshotStatus | null
): ScriptSnapshot[] {
  const next = loadHistory(scope).map((s) =>
    s.id === id ? { ...s, status: status ?? undefined } : s
  );
  saveHistory(scope, next);
  return next;
}

/** Most recent snapshot whose status is in the allowed set, or null. */
export function findLatestReleased(
  scope: string,
  allowed: SnapshotStatus[] = ["published", "final"]
): ScriptSnapshot | null {
  const set = new Set(allowed);
  for (const snap of loadHistory(scope)) {
    if (snap.status && set.has(snap.status)) return snap;
  }
  return null;
}

export function statusLabel(status: SnapshotStatus): string {
  return status === "published" ? "Published" : "Final";
}

export function reasonLabel(reason: SnapshotReason): string {
  switch (reason) {
    case "ai-compose":
      return "AI compose";
    case "ai-compile":
      return "AI compile";
    case "ai-regenerate":
      return "AI rewrite";
    case "template":
      return "Template";
    case "paste-import":
      return "Pasted text";
    case "outline-import":
      return "Imported outline";
    case "pace":
      return "Pace change";
    case "pre-restore":
      return "Before restore";
    case "manual":
    default:
      return "Edit";
  }
}

export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}
