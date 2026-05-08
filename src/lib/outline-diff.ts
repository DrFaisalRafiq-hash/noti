// ============================================================================
// Outline → compiled-script diff
// ----------------------------------------------------------------------------
// After "Compile outline" runs, we want to show the user a side-by-side view:
//
//   ┌───────────────────────┐   ┌───────────────────────────────────┐
//   │ Outline beat (input)  │ → │ Expanded dialogue / direction cues│
//   └───────────────────────┘   └───────────────────────────────────┘
//
// The edge function does not currently echo back which outline beat each
// expanded segment came from, so we infer it here. The heuristic walks the
// expanded segments in order and "switches" the active outline beat whenever
// it encounters an anchor it can confidently align to:
//
//   1. A "section" header whose label fuzzy-matches an outline section/beat
//      label (case-insensitive, ignoring punctuation).
//   2. A "scene_heading" whose text fuzzy-matches an outline scene_heading.
//   3. Otherwise, segments accrue under the current beat.
//
// Outline beats that are themselves dialogue / scene_heading / transition
// align 1-to-1 in the same order if no section anchors are found.
// ============================================================================

import type { ScriptSegment } from "./podcast-script";

export interface DiffPair {
  /** The original outline beat. Null = expanded content with no clear parent. */
  outline: ScriptSegment | null;
  /** Expanded segments produced for this beat (in order). May be empty. */
  expanded: ScriptSegment[];
}

export interface DiffStats {
  beatsTotal: number;
  beatsExpanded: number;
  expandedTotal: number;
  dialogueAdded: number;
  directionAdded: number;
  unmatched: number;
}

/** Build pairs by anchoring on labels first, then falling back to order. */
export function diffOutlineToCompiled(
  outline: ScriptSegment[],
  expanded: ScriptSegment[]
): DiffPair[] {
  if (!outline.length) {
    // No outline to align against — bucket everything as orphans.
    return expanded.length ? [{ outline: null, expanded: [...expanded] }] : [];
  }

  // Build pairs scaffold: one entry per outline beat, in order.
  const pairs: DiffPair[] = outline.map((o) => ({ outline: o, expanded: [] }));

  // Index outline anchors by normalized label / heading.
  const anchorIndex = new Map<string, number>();
  outline.forEach((o, idx) => {
    const key = anchorKey(o);
    if (key && !anchorIndex.has(key)) anchorIndex.set(key, idx);
  });

  // Detect whether the expanded list contains real anchors. If yes, use the
  // anchor-walk strategy. If no, fall back to ordered round-robin.
  const hasAnchors = expanded.some((seg) => {
    const key = anchorKey(seg);
    return key !== null && anchorIndex.has(key);
  });

  if (hasAnchors) {
    let cursor = 0; // index into pairs[] — current "open" beat
    // Skip leading non-anchor segments to the first outline beat.
    for (const seg of expanded) {
      const key = anchorKey(seg);
      if (key && anchorIndex.has(key)) {
        const next = anchorIndex.get(key)!;
        // Only move forward — don't jump backwards (avoids label collisions
        // earlier in the script silently re-opening an old beat).
        if (next >= cursor) cursor = next;
      }
      pairs[cursor].expanded.push(seg);
    }
    return pairs;
  }

  // ---- Fallback: ordered alignment ----
  // Distribute segments evenly under outline beats in order. Section /
  // scene_heading outline beats get 1 expanded section/scene_heading anchor
  // (if present) plus subsequent prose; pure dialogue beats get ~1 segment.
  const perBeat = Math.max(1, Math.floor(expanded.length / outline.length));
  let i = 0;
  for (let b = 0; b < pairs.length; b++) {
    const isLast = b === pairs.length - 1;
    const take = isLast ? expanded.length - i : perBeat;
    pairs[b].expanded = expanded.slice(i, i + take);
    i += take;
  }
  return pairs;
}

function anchorKey(seg: Pick<ScriptSegment, "kind" | "label" | "text">): string | null {
  if (seg.kind === "section" || seg.kind === "scene_heading") {
    const raw = (seg.label || seg.text || "").trim();
    if (!raw) return null;
    return seg.kind + ":" + normalize(raw);
  }
  return null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeDiff(pairs: DiffPair[]): DiffStats {
  let beatsExpanded = 0;
  let expandedTotal = 0;
  let dialogueAdded = 0;
  let directionAdded = 0;
  let unmatched = 0;

  for (const p of pairs) {
    if (p.outline === null) {
      unmatched += p.expanded.length;
    } else if (p.expanded.length > 0) {
      beatsExpanded++;
    }
    for (const e of p.expanded) {
      expandedTotal++;
      if (e.kind === "dialogue") dialogueAdded++;
      else if (e.kind === "direction") directionAdded++;
    }
  }

  return {
    beatsTotal: pairs.filter((p) => p.outline !== null).length,
    beatsExpanded,
    expandedTotal,
    dialogueAdded,
    directionAdded,
    unmatched,
  };
}
