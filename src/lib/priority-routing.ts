// ============================================================================
// Priority routing
// ----------------------------------------------------------------------------
// Maps a note's *urgency inputs* (mode + remind_at) to a priority/temperature
// folder color, then resolves (or creates) a folder of that color so the note
// lands in the right bucket without the user touching the Folder picker.
//
// Color → label mapping lives in folder-colors.ts:
//   rose    → Critical
//   amber   → High
//   teal    → Medium
//   indigo  → Low
//   neutral → None
// ============================================================================
import type { FolderColor } from "@/lib/folder-colors";

export type UrgencyMode = "note" | "task" | "reminder" | "meeting";

export interface RoutableFolder {
  id: string;
  name: string;
  color: string;
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Derive the priority color for a given mode + optional due time.
 *
 * - **note**: never auto-mapped (returns null) — plain notes have no urgency.
 * - **task** without a due date: defaults to High (amber). Tasks are
 *   actionable by nature; they belong above plain notes.
 * - **reminder / meeting**: derived from how soon they fire.
 *     ≤ 1h or overdue → Critical
 *     ≤ 24h           → High
 *     ≤ 3 days        → Medium
 *     > 3 days        → Low
 */
export function priorityForUrgency(
  mode: UrgencyMode,
  remindAtIso?: string | null,
  now: number = Date.now()
): FolderColor | null {
  if (mode === "note") return null;
  if (mode === "task") {
    // Tasks may also carry remind_at in some flows — honor it if present.
    if (remindAtIso) return priorityFromDelta(new Date(remindAtIso).getTime() - now);
    return "amber"; // High by default
  }
  // reminder / meeting
  if (!remindAtIso) return "amber"; // no time set yet → High placeholder
  return priorityFromDelta(new Date(remindAtIso).getTime() - now);
}

function priorityFromDelta(deltaMs: number): FolderColor {
  if (deltaMs <= HOUR) return "rose";       // Critical (incl. overdue)
  if (deltaMs <= DAY) return "amber";       // High
  if (deltaMs <= 3 * DAY) return "teal";    // Medium
  return "indigo";                          // Low
}

/** Default folder name for an auto-created priority bucket. */
export function defaultFolderNameForColor(color: FolderColor): string {
  switch (color) {
    case "rose":    return "Urgent";
    case "amber":   return "Today";
    case "teal":    return "This Week";
    case "indigo":  return "Later";
    case "neutral": return "Inbox";
  }
}

/**
 * Pick the best existing folder of `color`, or null if none exist.
 *
 * Preference order:
 *   1. Folder whose name matches the canonical default (case-insensitive)
 *   2. First folder of that color (stable ordering — caller controls input)
 */
export function pickFolderByColor(
  folders: RoutableFolder[],
  color: FolderColor
): RoutableFolder | null {
  const sameColor = folders.filter((f) => f.color === color);
  if (sameColor.length === 0) return null;
  const canonical = defaultFolderNameForColor(color).toLowerCase();
  const named = sameColor.find((f) => f.name.toLowerCase() === canonical);
  return named ?? sameColor[0];
}
