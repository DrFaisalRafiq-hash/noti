// ============================================================================
// Script pace recompiler
// ----------------------------------------------------------------------------
// Lets the user pick a speaking speed (wpm) and pause density, then rebuilds
// every segment's text (optionally injecting/stripping `[pause]` markers)
// and updates `durationSec` in place — no AI call needed.
//
// Density semantics:
//   - "none"   : strip every existing pause marker. Pauses contribute 0s.
//   - "light"  : keep existing markers as-is.
//   - "normal" : keep existing markers, plus add `[pause]` after every long
//                sentence (>22 words) that doesn't already end in a marker.
//   - "heavy"  : add `[pause]` after every sentence (>1 word).
// ============================================================================

import {
  estimateScriptSeconds,
  estimateSegmentSeconds,
  type PaceOptions,
  DEFAULT_WPM_SPOKEN,
  DEFAULT_WPM_ACTION,
} from "./script-timing";
import type { PodcastScript, ScriptSegment } from "./podcast-script";

export type PauseDensity = "none" | "light" | "normal" | "heavy";

export interface PaceSettings {
  wpmSpoken: number;
  wpmAction: number;
  density: PauseDensity;
  /** Optional target runtime in seconds. When set, applyPace will solve for
   *  wpm so the recompiled total ≈ this value (within wpm bounds). */
  targetSec?: number | null;
}

export const DEFAULT_PACE: PaceSettings = {
  wpmSpoken: DEFAULT_WPM_SPOKEN,
  wpmAction: DEFAULT_WPM_ACTION,
  density: "light",
  targetSec: null,
};

/** WPM bounds the solver is allowed to choose within. */
const WPM_MIN = 90;
const WPM_MAX = 220;

const STORAGE_KEY = "noti:script-pace:v1";

export function loadPace(historyKey: string): PaceSettings {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${historyKey}`);
    if (!raw) return { ...DEFAULT_PACE };
    const parsed = JSON.parse(raw);
    const targetSec =
      parsed.targetSec === null || parsed.targetSec === undefined
        ? null
        : clamp(parsed.targetSec, 30, 60 * 180, 0) || null;
    return {
      wpmSpoken: clamp(parsed.wpmSpoken, WPM_MIN, WPM_MAX, DEFAULT_PACE.wpmSpoken),
      wpmAction: clamp(parsed.wpmAction, WPM_MIN, WPM_MAX, DEFAULT_PACE.wpmAction),
      density: VALID_DENSITY.has(parsed.density) ? parsed.density : DEFAULT_PACE.density,
      targetSec,
    };
  } catch {
    return { ...DEFAULT_PACE };
  }
}

export function savePace(historyKey: string, pace: PaceSettings) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${historyKey}`, JSON.stringify(pace));
  } catch {
    /* ignore */
  }
}

const VALID_DENSITY = new Set(["none", "light", "normal", "heavy"]);

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.round(x)));
}

// --- pause marker rewriting ----------------------------------------------

/** Matches any pause marker we understand. */
const ANY_PAUSE_MARKER =
  /\s*(?:\[\s*pause(?:\s+\d+(?:\.\d+)?\s*s?)?\s*\]|\(\s*(?:pause|beat)(?:\s+\d+(?:\.\d+)?\s*s?)?\s*\))\s*/gi;

const SENTENCE_END = /([.!?…]+["')\]]*)\s+/g;

function stripMarkers(text: string): string {
  return text.replace(ANY_PAUSE_MARKER, " ").replace(/[ \t]{2,}/g, " ").trim();
}

function injectPauses(text: string, mode: "normal" | "heavy"): string {
  if (!text.trim()) return text;
  // Split on sentence boundaries so we can decide per-sentence.
  const out: string[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  SENTENCE_END.lastIndex = 0;
  while ((m = SENTENCE_END.exec(text)) !== null) {
    const sentenceWithPunct = text.slice(lastIdx, m.index + m[1].length);
    out.push(sentenceWithPunct);
    out.push(needsPause(sentenceWithPunct, mode) ? " [pause] " : " ");
    lastIdx = m.index + m[0].length;
  }
  out.push(text.slice(lastIdx));
  return out.join("").replace(/[ \t]{2,}/g, " ").trim();
}

function needsPause(sentence: string, mode: "normal" | "heavy"): boolean {
  // Avoid double-pause if the sentence already ends with a marker.
  if (/(\[\s*pause[^\]]*\]|\(\s*(?:pause|beat)[^)]*\))\s*$/i.test(sentence)) return false;
  const wordCount = sentence.trim().split(/\s+/).length;
  if (mode === "heavy") return wordCount > 1;
  // "normal": only after longer sentences
  return wordCount > 22;
}

function rewriteText(text: string, density: PauseDensity): string {
  switch (density) {
    case "none":
      return stripMarkers(text);
    case "light":
      return text; // keep as-is
    case "normal":
    case "heavy":
      // Strip existing markers first so we don't compound them, then inject fresh.
      return injectPauses(stripMarkers(text), density);
  }
}

// --- public API ----------------------------------------------------------

/**
 * Solve for a uniform WPM scale so that re-estimating `segments` (after the
 * pause-density rewrite) hits `targetSec` as closely as possible.
 *
 * Pause time is fixed (driven by markers + density), so we only scale the
 * spoken/action wpm together by a single factor. Returns the chosen
 * (wpmSpoken, wpmAction), clamped to [WPM_MIN, WPM_MAX].
 */
function solveWpmForTarget(
  rewrittenSegments: Pick<ScriptSegment, "kind" | "text">[],
  basePace: PaceSettings,
  targetSec: number
): { wpmSpoken: number; wpmAction: number; achievedSec: number; clamped: boolean } {
  // Current estimate at the user's chosen base wpm.
  const baseSec = estimateScriptSeconds(rewrittenSegments, {
    wpmSpoken: basePace.wpmSpoken,
    wpmAction: basePace.wpmAction,
  });

  // Estimate pause-only seconds by stripping all spoken contribution
  // (set wpm to a huge value so word time → ~0). Use 100000 wpm.
  const pauseOnlySec = estimateScriptSeconds(rewrittenSegments, {
    wpmSpoken: 100000,
    wpmAction: 100000,
  });

  const spokenSec = Math.max(0, baseSec - pauseOnlySec);
  const remaining = targetSec - pauseOnlySec;

  // If pauses alone already exceed the target, slow down to max we can.
  if (remaining <= 0 || spokenSec <= 0) {
    return {
      wpmSpoken: WPM_MIN,
      wpmAction: WPM_MIN,
      achievedSec: estimateScriptSeconds(rewrittenSegments, {
        wpmSpoken: WPM_MIN,
        wpmAction: WPM_MIN,
      }),
      clamped: true,
    };
  }

  // spokenSec scales as (baseWpm / newWpm). We want spoken portion = remaining.
  // newWpm = baseWpm * spokenSec / remaining.
  const factor = spokenSec / remaining;
  const rawSpoken = basePace.wpmSpoken * factor;
  const rawAction = basePace.wpmAction * factor;

  const wpmSpoken = Math.max(WPM_MIN, Math.min(WPM_MAX, Math.round(rawSpoken)));
  const wpmAction = Math.max(WPM_MIN, Math.min(WPM_MAX, Math.round(rawAction)));
  const clamped = wpmSpoken !== Math.round(rawSpoken) || wpmAction !== Math.round(rawAction);

  const achievedSec = estimateScriptSeconds(rewrittenSegments, { wpmSpoken, wpmAction });
  return { wpmSpoken, wpmAction, achievedSec, clamped };
}

/** Apply a pace to a script: rewrites dialogue text + recomputes durationSec.
 *  If `pace.targetSec` is set, solves for wpm to hit that target. */
export function applyPace(script: PodcastScript, pace: PaceSettings): PodcastScript {
  // First: rewrite text per density (independent of wpm).
  const rewritten: ScriptSegment[] = script.segments.map((seg) => {
    if (seg.kind === "dialogue" || seg.kind === "action") {
      return { ...seg, text: rewriteText(seg.text, pace.density) };
    }
    return { ...seg };
  });

  // Then: choose final wpm — either user-specified, or solved to target.
  let wpmSpoken = pace.wpmSpoken;
  let wpmAction = pace.wpmAction;
  if (pace.targetSec && pace.targetSec > 0) {
    const solved = solveWpmForTarget(rewritten, pace, pace.targetSec);
    wpmSpoken = solved.wpmSpoken;
    wpmAction = solved.wpmAction;
  }

  const paceOpts: PaceOptions = { wpmSpoken, wpmAction };
  const segments = rewritten.map((seg) => ({
    ...seg,
    durationSec: estimateSegmentSeconds({ kind: seg.kind, text: seg.text }, paceOpts),
  }));

  return { ...script, segments };
}

/** Preview what total runtime a given pace would produce on a script,
 *  without mutating it. Useful for showing "≈ 4:32" next to the target input. */
export function previewPaceSeconds(script: PodcastScript, pace: PaceSettings): number {
  return applyPace(script, pace).segments.reduce(
    (sum, s) => sum + (s.durationSec ?? 0),
    0
  );
}

export function paceLabel(d: PauseDensity): string {
  switch (d) {
    case "none":
      return "No pauses";
    case "light":
      return "Light";
    case "normal":
      return "Normal";
    case "heavy":
      return "Heavy";
  }
}

/** Parse a "mm:ss" or "m" string into seconds. Returns null on invalid. */
export function parseRuntimeInput(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const mmss = v.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const num = Number(v);
  if (Number.isFinite(num) && num > 0) return Math.round(num * 60);
  return null;
}

/** Format seconds as "m:ss" for the input field. */
export function formatRuntimeInput(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
