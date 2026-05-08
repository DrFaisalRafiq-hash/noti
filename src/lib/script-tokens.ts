/**
 * Placeholder tokens that writers can drop into any segment to mark
 * sound effects, music beds, calls-to-action, ad breaks, pauses, etc.
 *
 * Tokens stay as plain text inside the segment so they survive export,
 * paste, and round-trips. The script timing engine already understands
 * `[pause Ns]` (case-insensitive), so `[PAUSE 2s]` automatically counts
 * toward the segment's estimated duration.
 */

export type ScriptTokenId =
  | "sfx"
  | "music"
  | "cta"
  | "ad"
  | "pause"
  | "broll"
  | "note";

export interface ScriptToken {
  id: ScriptTokenId;
  label: string;
  description: string;
  /** Text inserted into the textarea. */
  snippet: string;
  /**
   * Caret offset *within the snippet* after insertion.
   * For `[SFX: ]` this is 6 — right after the colon-space, ready to type.
   */
  cursorOffset: number;
  /** Short hint shown next to the snippet preview. */
  hint?: string;
}

export const SCRIPT_TOKENS: ScriptToken[] = [
  {
    id: "sfx",
    label: "SFX",
    description: "Sound effect cue",
    snippet: "[SFX: ]",
    cursorOffset: 6,
    hint: "e.g. door slam",
  },
  {
    id: "music",
    label: "Music",
    description: "Music bed or sting",
    snippet: "[MUSIC: ]",
    cursorOffset: 8,
    hint: "e.g. soft piano in",
  },
  {
    id: "cta",
    label: "CTA",
    description: "Call-to-action placeholder",
    snippet: "[CTA: ]",
    cursorOffset: 6,
    hint: "subscribe / share / link",
  },
  {
    id: "ad",
    label: "Ad break",
    description: "Mid-roll ad marker",
    snippet: "[AD BREAK]",
    cursorOffset: 10,
  },
  {
    id: "pause",
    label: "Pause",
    description: "Timed pause — counts toward duration",
    snippet: "[PAUSE 2s]",
    cursorOffset: 7, // inside the number, easy to retype
    hint: "auto-timed",
  },
  {
    id: "broll",
    label: "B-roll",
    description: "Visual cue for video scripts",
    snippet: "[B-ROLL: ]",
    cursorOffset: 9,
  },
  {
    id: "note",
    label: "Note",
    description: "Internal author note",
    snippet: "[NOTE: ]",
    cursorOffset: 7,
  },
];
