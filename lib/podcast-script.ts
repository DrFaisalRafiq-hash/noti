// ============================================================================
// Podcast script encoding
// ----------------------------------------------------------------------------
// Scripts live inside a regular note's `text` field, so they sync, search,
// and back up like any other note. We prefix the body with a sentinel marker
// followed by JSON. Anything else after the JSON (legacy text) is preserved
// in `trailing` so we never destroy user content if a parse fails.
// ============================================================================

/** What kind of script this is. */
export type ScriptKind = "podcast" | "screenplay" | "comic";

/** Output format. Podcast = segmented/dialogue. Screenplay = screenplay/teleplay/stageplay. Comic = comic. */
export type ScriptFormat =
  | "segmented"
  | "dialogue"
  | "screenplay"
  | "teleplay"
  | "stageplay"
  | "comic";

export type ScriptTone =
  // Podcast tones
  | "conversational"
  | "interview"
  | "narrative"
  | "educational"
  | "comedic"
  | "investigative"
  // Screenplay tones
  | "drama"
  | "thriller"
  | "horror"
  | "romance"
  | "sci-fi"
  | "fantasy"
  | "action"
  | "documentary"
  // Comic tones
  | "superhero"
  | "noir"
  | "slice-of-life"
  | "manga"
  | "indie";

export interface ScriptBrief {
  topic: string;
  /** For podcasts: minutes runtime. For screenplays: page count. For comics: page count. */
  lengthMin: number;
  tone: ScriptTone;
  /** Character / speaker display names — at least 1, max 8 for screenplays/comics, 4 for podcasts. */
  speakers: string[];
  /** Optional bullet talking / story / page points. */
  talkingPoints: string[];
  /** Free-form extra direction. */
  notes?: string;
  /** Logline — used for screenplays and comics. */
  logline?: string;
  /** Genre — used for screenplays and comics. */
  genre?: string;
}

/** A structured beat in the script. */
export interface ScriptSegment {
  id: string;
  /**
   * Block kind.
   *  - "section"        — podcast section header
   *  - "dialogue"       — spoken line (label = speaker / character)
   *  - "direction"      — short stage cue (also used as parenthetical for screenplays)
   *  - "scene_heading"  — screenplay slug line
   *  - "action"         — screenplay action / description prose
   *  - "transition"     — screenplay transition
   *  - "page"           — comic page break (label = "Page 1" or arc title)
   *  - "panel"          — comic panel description (label optional)
   *  - "caption"        — comic narration / caption box
   *  - "sfx"            — comic sound effect
   */
  kind:
    | "section"
    | "dialogue"
    | "direction"
    | "scene_heading"
    | "action"
    | "transition"
    | "page"
    | "panel"
    | "caption"
    | "sfx";
  /** For dialogue: speaker / character name; for section/scene_heading/page: title. */
  label?: string;
  /** Body text. */
  text: string;
  /** Optional duration estimate in seconds (podcast) — unused for screenplays/comics. */
  durationSec?: number;
}


/** Per-script persona assignment, baked into the note body so cast travels
 *  with the script across saves, recompiles, restores and shared links. */
export interface ScriptCastEntry {
  /** Lowercased speaker label as it appears on dialogue cues. */
  speaker: string;
  /** Persona row id from `cast_personas`. May reference a deleted persona — UI tolerates that. */
  personaId: string;
}

export interface PodcastScript {
  v: 1;
  /** Podcast or screenplay. Defaults to "podcast" when missing for backward compatibility. */
  kind?: ScriptKind;
  format: ScriptFormat;
  brief: ScriptBrief;
  segments: ScriptSegment[];
  /** Speaker → persona mappings stored alongside the script. Optional for
   *  back-compat with older notes. */
  cast?: ScriptCastEntry[];
}

const MARKER = "<!--noti:script-v1-->";

export function emptyBrief(): ScriptBrief {
  return {
    topic: "",
    lengthMin: 15,
    tone: "conversational",
    speakers: ["Host"],
    talkingPoints: [],
    notes: "",
  };
}

export function emptyScript(format: ScriptFormat = "segmented", kind: ScriptKind = "podcast"): PodcastScript {
  const brief = emptyBrief();
  if (kind === "screenplay") {
    brief.tone = "drama";
    brief.speakers = ["PROTAGONIST"];
    brief.lengthMin = 5;
  } else if (kind === "comic") {
    brief.tone = "superhero";
    brief.speakers = ["HERO"];
    brief.lengthMin = 6;
  }
  return { v: 1, kind, format, brief, segments: [] };
}

export function isScriptBody(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.trimStart().startsWith(MARKER);
}

/** Parse a note body into a PodcastScript, or null if not a script. */
export function parseScript(text: string | null | undefined): PodcastScript | null {
  if (!isScriptBody(text)) return null;
  const body = (text as string).trimStart().slice(MARKER.length).trimStart();
  // JSON ends at the last balanced "}" — tolerate trailing whitespace/text.
  try {
    // Greedy: try the whole remaining string first, then walk back.
    const direct = tryParse(body);
    if (direct) return normalize(direct);
    // Fallback: find a closing brace
    for (let i = body.length; i > 0; i--) {
      if (body[i - 1] !== "}") continue;
      const candidate = body.slice(0, i);
      const parsed = tryParse(candidate);
      if (parsed) return normalize(parsed);
    }
  } catch {
    /* fall through */
  }
  return null;
}

function tryParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function normalize(raw: any): PodcastScript {
  const validFormats: ScriptFormat[] = ["segmented", "dialogue", "screenplay", "teleplay", "stageplay", "comic"];
  const fmt: ScriptFormat = validFormats.includes(raw.format) ? raw.format : "segmented";
  const kind: ScriptKind =
    raw.kind === "comic" || fmt === "comic"
      ? "comic"
      : raw.kind === "screenplay" || ["screenplay", "teleplay", "stageplay"].includes(fmt)
      ? "screenplay"
      : "podcast";
  const validKinds: ScriptSegment["kind"][] = [
    "section",
    "dialogue",
    "direction",
    "scene_heading",
    "action",
    "transition",
    "page",
    "panel",
    "caption",
    "sfx",
  ];
  const speakerCap = kind === "podcast" ? 4 : 8;
  return {
    v: 1,
    kind,
    format: fmt,
    brief: {
      topic: String(raw.brief?.topic ?? ""),
      lengthMin: Number(raw.brief?.lengthMin ?? 15) || 15,
      tone: (raw.brief?.tone ?? (kind === "screenplay" ? "drama" : kind === "comic" ? "superhero" : "conversational")) as ScriptTone,
      speakers:
        Array.isArray(raw.brief?.speakers) && raw.brief.speakers.length
          ? raw.brief.speakers.map((s: any) => String(s)).slice(0, speakerCap)
          : kind === "screenplay"
          ? ["PROTAGONIST"]
          : kind === "comic"
          ? ["HERO"]
          : ["Host"],
      talkingPoints: Array.isArray(raw.brief?.talkingPoints)
        ? raw.brief.talkingPoints.map((s: any) => String(s))
        : [],
      notes: raw.brief?.notes ? String(raw.brief.notes) : "",
      logline: raw.brief?.logline ? String(raw.brief.logline) : "",
      genre: raw.brief?.genre ? String(raw.brief.genre) : "",
    },
    segments: Array.isArray(raw.segments)
      ? raw.segments.map((s: any, i: number) => ({
          id: String(s.id ?? `seg-${i}-${Math.random().toString(36).slice(2, 8)}`),
          kind: validKinds.includes(s.kind) ? s.kind : "dialogue",
          label: s.label ? String(s.label) : undefined,
          text: String(s.text ?? ""),
          durationSec: typeof s.durationSec === "number" ? s.durationSec : undefined,
        }))
      : [],
    cast: Array.isArray(raw.cast)
      ? (raw.cast as any[])
          .map((c) => ({
            speaker: String(c?.speaker ?? "").trim().toLowerCase(),
            personaId: String(c?.personaId ?? c?.persona_id ?? ""),
          }))
          .filter((c) => c.speaker && c.personaId)
      : undefined,
  };
}

/** Serialize a script for storage in note.text. */
export function serializeScript(script: PodcastScript): string {
  return `${MARKER}\n${JSON.stringify(script)}`;
}

/**
 * Render a script as plain text (for copy / share / search / .txt export).
 *
 * Screenplays use industry-standard fixed-column layout on a 60-char page:
 *   col 0   action / scene heading        (left margin)
 *   col 16  parentheticals                ("(beat)")
 *   col 25  character cue                 (UPPERCASE)
 *   col 10  dialogue, wrapped to ~35 cols
 *   right   transitions                   (right-aligned at col 60)
 *
 * Podcasts get a cleaner, conversational layout with section dividers
 * and 2-space indented dialogue under the speaker cue.
 */
export function scriptToPlainText(script: PodcastScript): string {
  const isScreenplay = script.kind === "screenplay";
  const isComic = script.kind === "comic";
  const PAGE = 60;

  const lines: string[] = [];

  if (isComic) {
    const title = (script.brief.topic || "Untitled").toUpperCase();
    lines.push(centerLine(title, PAGE));
    if (script.brief.logline) {
      lines.push("");
      lines.push(...wrapLines(script.brief.logline, PAGE).map((l) => centerLine(l, PAGE)));
    }
    lines.push("", "");
    let panelNum = 0;
    let pageNum = 0;
    for (const s of script.segments) {
      switch (s.kind) {
        case "page": {
          pageNum++;
          panelNum = 0;
          const label = s.label?.trim() ? ` — ${s.label.trim()}` : "";
          lines.push("", "", `PAGE ${pageNum}${label}`.toUpperCase(), "─".repeat(PAGE));
          if (s.text) for (const w of wrapLines(s.text, PAGE)) lines.push(w);
          break;
        }
        case "panel": {
          panelNum++;
          const label = s.label?.trim() ? ` — ${s.label.trim()}` : "";
          lines.push("", `Panel ${panelNum}${label}`);
          if (s.text) for (const w of wrapLines(s.text, PAGE)) lines.push(`  ${w}`);
          break;
        }
        case "caption":
          lines.push("", `CAPTION: ${s.text}`);
          break;
        case "dialogue": {
          const who = (s.label || "").toUpperCase().trim();
          lines.push(who ? `  ${who}: ${s.text}` : `  ${s.text}`);
          break;
        }
        case "direction":
          lines.push(`  (${s.text})`);
          break;
        case "sfx":
          lines.push(`  SFX: ${s.text.toUpperCase()}`);
          break;
        default:
          if (s.text) lines.push(s.text);
      }
    }
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // Title block
  if (isScreenplay) {
    const title = (script.brief.topic || "Untitled").toUpperCase();
    lines.push(centerLine(title, PAGE));
    if (script.brief.logline) {
      lines.push("");
      lines.push(...wrapLines(script.brief.logline, PAGE).map((l) => centerLine(l, PAGE)));
    }
    lines.push("", "");
  } else {
    if (script.brief.topic) lines.push(script.brief.topic, "");
    if (script.brief.logline) lines.push(`Logline: ${script.brief.logline}`, "");
  }

  if (isScreenplay) {
    for (const s of script.segments) {
      switch (s.kind) {
        case "scene_heading": {
          const slug = (s.label || s.text || "SCENE").toUpperCase().trim();
          lines.push("", slug, "");
          break;
        }
        case "action": {
          for (const w of wrapLines(s.text, PAGE)) lines.push(w);
          lines.push("");
          break;
        }
        case "transition": {
          const t = (s.text || "CUT TO:").toUpperCase().trim();
          lines.push("", padLeft(t, PAGE), "");
          break;
        }
        case "direction": {
          // Parenthetical, indent col 16, max ~24 cols
          const inner = `(${s.text.trim()})`;
          for (const w of wrapLines(inner, 24)) lines.push(indent(w, 16));
          break;
        }
        case "dialogue": {
          if (s.label) lines.push(indent(s.label.toUpperCase().trim(), 25));
          for (const w of wrapLines(s.text, 35)) lines.push(indent(w, 10));
          lines.push("");
          break;
        }
        case "section": {
          // Treat as an act / part divider in screenplays.
          const label = (s.label || "PART").toUpperCase().trim();
          lines.push("", centerLine(label, PAGE), "");
          if (s.text) for (const w of wrapLines(s.text, PAGE)) lines.push(w);
          break;
        }
      }
    }
  } else {
    // Podcast layout — readable left-aligned with section rules.
    for (const s of script.segments) {
      switch (s.kind) {
        case "section": {
          lines.push("", `── ${s.label || "Section"} ──`);
          if (s.text) lines.push(s.text);
          break;
        }
        case "scene_heading": {
          lines.push("", (s.label || s.text || "SCENE").toUpperCase());
          break;
        }
        case "action": {
          lines.push(s.text);
          break;
        }
        case "transition": {
          lines.push("", (s.text || "CUT TO:").toUpperCase());
          break;
        }
        case "direction": {
          lines.push(`(${s.text})`);
          break;
        }
        case "dialogue": {
          const who = s.label?.trim();
          if (who) {
            lines.push("", `${who.toUpperCase()}:`);
            for (const w of wrapLines(s.text, 70)) lines.push(`  ${w}`);
          } else {
            for (const w of wrapLines(s.text, 70)) lines.push(w);
          }
          break;
        }
      }
    }
  }

  // Collapse runs of >2 blank lines down to exactly 1 blank line.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// --- text layout helpers --------------------------------------------------

function indent(s: string, cols: number): string {
  return " ".repeat(Math.max(0, cols)) + s;
}

function padLeft(s: string, width: number): string {
  const pad = Math.max(0, width - s.length);
  return " ".repeat(pad) + s;
}

function centerLine(s: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - s.length) / 2));
  return " ".repeat(pad) + s;
}

/** Word-wrap a string to `width` columns. Preserves intentional line breaks. */
function wrapLines(text: string, width: number): string[] {
  const out: string[] = [];
  const paragraphs = (text || "").split(/\n/);
  for (const p of paragraphs) {
    if (!p.trim()) {
      out.push("");
      continue;
    }
    const words = p.split(/\s+/);
    let cur = "";
    for (const w of words) {
      if (!cur) {
        cur = w;
      } else if (cur.length + 1 + w.length <= width) {
        cur += " " + w;
      } else {
        out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

export function newId(): string {
  return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
