// ============================================================================
// Outline import
// ----------------------------------------------------------------------------
// Turn pasted plain-text or JSON outlines into ScriptSegment[] that the
// editor can drop in (and then expand via the existing "Compile outline"
// AI action).
//
// Two input shapes are supported:
//
// 1) JSON — either an array of beats, or { segments: [...] } /
//    { outline: [...] }. Each beat may use any of these field names:
//      - kind:    "section" | "dialogue" | "direction" | "scene_heading"
//                 | "action" | "transition"   (default: "section")
//      - label / speaker / who / title / heading
//      - text / body / line / content / note   (default: "")
//
// 2) Plain text — line-based, with a few conventions writers actually
//    use. We do NOT require any specific format; we just recognize useful
//    cues:
//
//      # Heading                   → section, label="Heading"
//      ## Heading                  → section
//      INT. KITCHEN — NIGHT        → scene_heading (all-caps slugline)
//      EXT. ROOFTOP - DAY          → scene_heading
//      CUT TO:    /  FADE OUT.     → transition
//      SPEAKER: line of dialogue   → dialogue, label="SPEAKER"
//      [Sarah] line of dialogue    → dialogue, label="Sarah"
//      Sarah — line of dialogue    → dialogue, label="Sarah"   (em/en dash)
//      (laughs softly)             → direction
//      - bullet beat               → section beat
//      * bullet beat               → section beat
//      • bullet beat               → section beat
//      1. numbered beat            → section beat
//      anything else               → action paragraph
//
// Blank lines split paragraphs. A line that's clearly a continuation of
// the previous dialogue (no leading "SPEAKER:" pattern) is appended to
// that dialogue block.
// ============================================================================

import { newId, type ScriptSegment } from "./podcast-script";

export type OutlineFormat = "json" | "text";

export interface OutlineParseIssue {
  /** 1-based line number in the original input, when relevant. */
  line?: number;
  message: string;
}

export interface OutlineParseResult {
  /** Detected/parsed format. */
  format: OutlineFormat;
  /** Parsed segments, ready to drop into PodcastScript.segments. */
  segments: ScriptSegment[];
  /** Soft warnings ("3 lines were skipped"). Empty on a clean parse. */
  issues: OutlineParseIssue[];
}

/** Top-level: try JSON first if the input looks like JSON, else fall back to text. */
export function parseOutline(input: string): OutlineParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { format: "text", segments: [], issues: [{ message: "Outline is empty." }] };
  }
  if (looksLikeJson(trimmed)) {
    try {
      return parseOutlineJson(trimmed);
    } catch (e) {
      // Fall through to text mode, but surface the JSON error as a warning.
      const text = parseOutlineText(trimmed);
      return {
        ...text,
        issues: [
          { message: `Could not parse as JSON (${(e as Error).message}). Falling back to plain text.` },
          ...text.issues,
        ],
      };
    }
  }
  return parseOutlineText(trimmed);
}

function looksLikeJson(s: string): boolean {
  return (s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"));
}

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

const VALID_KINDS: ScriptSegment["kind"][] = [
  "section",
  "dialogue",
  "direction",
  "scene_heading",
  "action",
  "transition",
];

export function parseOutlineJson(input: string): OutlineParseResult {
  const data = JSON.parse(input);
  const arr = extractArray(data);
  if (!arr) {
    return {
      format: "json",
      segments: [],
      issues: [{ message: "JSON must be an array of beats, or an object with a 'segments' / 'outline' array." }],
    };
  }

  const issues: OutlineParseIssue[] = [];
  const segments: ScriptSegment[] = [];

  arr.forEach((raw, idx) => {
    if (raw == null || typeof raw !== "object") {
      issues.push({ message: `Item #${idx + 1} is not an object — skipped.` });
      return;
    }
    const obj = raw as Record<string, unknown>;
    const rawKind = String(obj.kind ?? obj.type ?? "section").toLowerCase().trim() as ScriptSegment["kind"];
    const kind: ScriptSegment["kind"] = VALID_KINDS.includes(rawKind) ? rawKind : "section";
    if (!VALID_KINDS.includes(rawKind)) {
      issues.push({
        message: `Item #${idx + 1}: unknown kind "${rawKind}" — defaulted to "section".`,
      });
    }

    const label = pickString(obj, ["label", "speaker", "who", "title", "heading", "name"]);
    const text = pickString(obj, ["text", "body", "line", "content", "note", "description"]) ?? "";

    segments.push({
      id: newId(),
      kind,
      label: label || undefined,
      text: text.trim(),
    });
  });

  if (!segments.length) {
    issues.push({ message: "No usable beats found in JSON." });
  }

  return { format: "json", segments, issues };
}

function extractArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["segments", "outline", "beats", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Plain-text parser
// ---------------------------------------------------------------------------

const RE_HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const RE_SCENE_SLUG = /^\s*(?:INT|EXT|I\/E|INT\.?\/EXT\.?)\b[. ].*?(?:--|—|-)\s*(?:DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|LATER|SAME|MOMENTS LATER)\.?\s*$/i;
const RE_TRANSITION = /^\s*(CUT TO|FADE (?:IN|OUT)|FADE TO BLACK|SMASH CUT|MATCH CUT|DISSOLVE TO|TIME CUT|HARD CUT|JUMP CUT)[.: ]?\s*$/i;
// "SPEAKER:" — speaker can be 1-4 words, letters/numbers/spaces, optional (V.O.) / (O.S.) / (CONT'D)
const RE_SPEAKER_COLON =
  /^\s*([A-Z][A-Z0-9 .'\-]{0,40}?)(?:\s*\(([^)]{1,20})\))?\s*:\s+(.+)$/;
// "Mixed Case Speaker:" — looser, requires capitalized first word + colon
const RE_LOOSE_SPEAKER_COLON =
  /^\s*([A-Z][\w'.\-]+(?:\s+[A-Z][\w'.\-]+){0,3})\s*:\s+(.+)$/;
// "[Sarah] line"
const RE_BRACKETED_SPEAKER = /^\s*[\[\(]\s*([A-Za-z][\w '.\-]{0,40}?)\s*[\]\)]\s*[:\-—–]?\s*(.+)$/;
// "Sarah — line of dialogue" or "Sarah – line"
const RE_DASH_SPEAKER = /^\s*([A-Z][\w'.\-]+(?:\s+[A-Z][\w'.\-]+){0,3})\s+[—–]\s+(.+)$/;
// Bullets / numbered list items — used as section/outline beats
const RE_BULLET = /^\s*(?:[-*•·]|\d+[.)])\s+(.+)$/;
// Pure parenthetical line "(laughs)" → direction
const RE_PARENTHETICAL = /^\s*\(([^)]+)\)\s*$/;

export function parseOutlineText(input: string): OutlineParseResult {
  const segments: ScriptSegment[] = [];
  const issues: OutlineParseIssue[] = [];
  const rawLines = input.replace(/\r\n?/g, "\n").split("\n");

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Skip blank lines.
    if (!trimmed) {
      i++;
      continue;
    }

    // 1) Markdown heading → section
    const heading = trimmed.match(RE_HEADING);
    if (heading) {
      segments.push(mkSeg("section", heading[2], "", heading[2]));
      i++;
      continue;
    }

    // 2) Scene slugline → scene_heading
    if (RE_SCENE_SLUG.test(trimmed)) {
      segments.push(mkSeg("scene_heading", trimmed.toUpperCase(), "", trimmed));
      i++;
      continue;
    }

    // 3) Transition
    if (RE_TRANSITION.test(trimmed)) {
      segments.push(mkSeg("transition", undefined, trimmed.toUpperCase()));
      i++;
      continue;
    }

    // 4) Pure parenthetical → direction
    const paren = trimmed.match(RE_PARENTHETICAL);
    if (paren) {
      segments.push(mkSeg("direction", undefined, paren[1].trim()));
      i++;
      continue;
    }

    // 5) Speaker cue (most specific → loosest)
    const speakerMatch =
      trimmed.match(RE_SPEAKER_COLON) ||
      trimmed.match(RE_BRACKETED_SPEAKER) ||
      trimmed.match(RE_DASH_SPEAKER) ||
      trimmed.match(RE_LOOSE_SPEAKER_COLON);
    if (speakerMatch) {
      // Different regexes have different capture groups — normalize.
      let speaker: string;
      let body: string;
      if (speakerMatch === trimmed.match(RE_SPEAKER_COLON)) {
        speaker = formatSpeaker(speakerMatch[1]) +
          (speakerMatch[2] ? ` (${speakerMatch[2].trim()})` : "");
        body = speakerMatch[3];
      } else {
        speaker = formatSpeaker(speakerMatch[1]);
        body = speakerMatch[speakerMatch.length - 1];
      }
      // Consume continuation lines (non-blank, no new cue, not a heading/slug).
      const buf: string[] = [body.trim()];
      let j = i + 1;
      while (j < rawLines.length) {
        const nxt = rawLines[j];
        const nxtTrim = nxt.trim();
        if (!nxtTrim) break;
        if (isStructuralLine(nxtTrim)) break;
        buf.push(nxtTrim);
        j++;
      }
      segments.push(mkSeg("dialogue", speaker, buf.join(" ")));
      i = j;
      continue;
    }

    // 6) Bullet → section beat (label = first ~6 words, full text in body)
    const bullet = trimmed.match(RE_BULLET);
    if (bullet) {
      const body = bullet[1].trim();
      segments.push(mkSeg("section", titleize(body), body));
      i++;
      continue;
    }

    // 7) Fallback: gather paragraph as an "action" beat (collects until blank line).
    const buf: string[] = [trimmed];
    let j = i + 1;
    while (j < rawLines.length) {
      const nxt = rawLines[j];
      const nxtTrim = nxt.trim();
      if (!nxtTrim) break;
      if (isStructuralLine(nxtTrim)) break;
      buf.push(nxtTrim);
      j++;
    }
    segments.push(mkSeg("action", undefined, buf.join(" ")));
    i = j;
  }

  if (!segments.length) {
    issues.push({ message: "Could not extract any beats from the text." });
  }

  return { format: "text", segments, issues };
}

function isStructuralLine(t: string): boolean {
  return (
    RE_HEADING.test(t) ||
    RE_SCENE_SLUG.test(t) ||
    RE_TRANSITION.test(t) ||
    RE_PARENTHETICAL.test(t) ||
    RE_BULLET.test(t) ||
    RE_SPEAKER_COLON.test(t) ||
    RE_BRACKETED_SPEAKER.test(t) ||
    RE_DASH_SPEAKER.test(t) ||
    RE_LOOSE_SPEAKER_COLON.test(t)
  );
}

function mkSeg(
  kind: ScriptSegment["kind"],
  label: string | undefined,
  text: string,
  rawLabel?: string
): ScriptSegment {
  return {
    id: newId(),
    kind,
    label: label?.trim() || undefined,
    text: (text ?? "").trim(),
  };
}

/** Normalize a speaker label. Leaves ALL-CAPS as-is (screenplay convention),
 *  Title-cases mixed input. */
function formatSpeaker(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  // If user wrote it in all caps (or mostly), keep it.
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 2 && letters === letters.toUpperCase()) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function titleize(s: string): string {
  const first = s.split(/[.!?]/)[0].trim();
  const words = first.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 60 ? words.slice(0, 57) + "…" : words;
}

// ---------------------------------------------------------------------------
// Stats helpers (used by the modal preview)
// ---------------------------------------------------------------------------

export interface OutlineStats {
  total: number;
  byKind: Partial<Record<ScriptSegment["kind"], number>>;
  speakers: string[];
}

export function summarizeOutline(segments: ScriptSegment[]): OutlineStats {
  const byKind: Partial<Record<ScriptSegment["kind"], number>> = {};
  const speakerSet = new Set<string>();
  for (const s of segments) {
    byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    if (s.kind === "dialogue" && s.label) speakerSet.add(s.label);
  }
  return { total: segments.length, byKind, speakers: [...speakerSet].sort() };
}
