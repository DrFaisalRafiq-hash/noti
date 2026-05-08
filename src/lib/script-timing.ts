// ============================================================================
// Script timing
// ----------------------------------------------------------------------------
// Live duration estimates for script segments. Used in the editor (per-segment
// chip + total in the header) and anywhere else we want a runtime preview.
//
// Heuristic:
//   - 155 wpm for spoken dialogue / sections
//   - 130 wpm for screenplay action prose
//   - direction / transition / scene heading contribute only their explicit
//     pause markers, no spoken time
// ============================================================================

import type { ScriptSegment } from "./podcast-script";

export const DEFAULT_WPM_SPOKEN = 155;
export const DEFAULT_WPM_ACTION = 130;

/** Multiplier applied to detected pause durations. 1 = literal, 0 = ignore. */
export interface PaceOptions {
  wpmSpoken?: number;
  wpmAction?: number;
  /** 0 = strip all pause time, 1 = literal, 1.5 = stretch pauses 50%. */
  pauseScale?: number;
}

/** Pause markers we recognize. Each pattern can capture an optional numeric
 *  value (seconds) so writers can write `[pause 3s]`, `[pause 2]`, `(pause 1.5s)`. */
const PAUSE_PATTERNS: { re: RegExp; defaultSec: number }[] = [
  // [pause], [pause 2s], [pause 1.5]
  { re: /\[\s*pause(?:\s+(\d+(?:\.\d+)?)\s*s?)?\s*\]/gi, defaultSec: 1.0 },
  // (pause), (beat), (pause 2s)
  { re: /\(\s*(?:pause|beat)(?:\s+(\d+(?:\.\d+)?)\s*s?)?\s*\)/gi, defaultSec: 0.8 },
  // standalone "..." or "…" — short hesitation
  { re: /\.{3,}|…/g, defaultSec: 0.4 },
  // em-dash / en-dash surrounded by spaces — a beat
  { re: /\s[—–]\s/g, defaultSec: 0.3 },
];

export interface SegmentTiming {
  /** Total estimated seconds for this segment (words + pauses). */
  seconds: number;
  /** Word count after pause markers were stripped. */
  words: number;
  /** Number of explicit pause markers detected. */
  pauseCount: number;
  /** Seconds attributable to pauses alone (after pauseScale). */
  pauseSeconds: number;
}

/** Estimate duration of one segment based on its current text + kind. */
export function estimateSegmentTiming(
  seg: Pick<ScriptSegment, "kind" | "text">,
  pace: PaceOptions = {}
): SegmentTiming {
  const wpmSpoken = pace.wpmSpoken ?? DEFAULT_WPM_SPOKEN;
  const wpmAction = pace.wpmAction ?? DEFAULT_WPM_ACTION;
  const pauseScale = pace.pauseScale ?? 1;

  const raw = seg.text || "";

  let stripped = raw;
  let pauseSeconds = 0;
  let pauseCount = 0;
  for (const { re, defaultSec } of PAUSE_PATTERNS) {
    stripped = stripped.replace(re, (_m, captured?: string) => {
      pauseCount++;
      const explicit = captured ? Number(captured) : NaN;
      pauseSeconds += Number.isFinite(explicit) ? explicit : defaultSec;
      return " ";
    });
  }
  pauseSeconds *= pauseScale;

  const words = stripped
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((w) => w.length > 0).length;

  let wpm = wpmSpoken;
  if (seg.kind === "action") wpm = wpmAction;
  if (seg.kind === "direction" || seg.kind === "transition" || seg.kind === "scene_heading") {
    wpm = 0;
  }

  const wordSeconds = wpm > 0 ? (words / wpm) * 60 : 0;
  const seconds = Math.max(0, Math.round(wordSeconds + pauseSeconds));

  return { seconds, words, pauseCount, pauseSeconds };
}

export function estimateSegmentSeconds(
  seg: Pick<ScriptSegment, "kind" | "text">,
  pace: PaceOptions = {}
): number {
  return estimateSegmentTiming(seg, pace).seconds;
}

export function estimateScriptSeconds(
  segments: Pick<ScriptSegment, "kind" | "text">[],
  pace: PaceOptions = {}
): number {
  return segments.reduce((sum, s) => sum + estimateSegmentSeconds(s, pace), 0);
}

/** Format seconds as e.g. "0:45", "1:02", "12:30". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
