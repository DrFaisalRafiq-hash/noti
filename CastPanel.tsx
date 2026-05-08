// ============================================================================
// CastPanel
// ----------------------------------------------------------------------------
// Sits above the script segments. Auto-detects every speaker name used in
// `script.segments[*].label` (dialogue only) and lets the user assign each
// one to a saved persona. Personas are reusable across all of the user's
// scripts (table: cast_personas, mappings: script_cast).
// ============================================================================

import { useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  X,
  Check,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  AGE_RANGES,
  GENDERS,
  PERSONA_COLORS,
  SUGGESTED_TONE_TAGS,
  assignSpeaker,
  createPersona,
  deletePersona,
  personaColorClass,
  unassignSpeaker,
  updatePersona,
  type CastPersona,
  type PersonaInput,
} from "@/lib/cast";
import type { PodcastScript } from "@/lib/podcast-script";
import type { CastState } from "@/hooks/useCast";
import { cn } from "@/lib/utils";

interface Props {
  script: PodcastScript;
  cast: CastState;
  /** Persist a per-script speaker→persona mapping onto the script body itself.
   *  Pass `personaId = null` to clear. When omitted, the panel still updates
   *  the user-wide default mapping but doesn't pin it to this note. */
  onCastChange?: (speaker: string, personaId: string | null) => void;
}

export default function CastPanel({ script, cast, onCastChange }: Props) {
  const { personas, index: castIndex, loading, signedOut, refresh } = cast;
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<CastPersona | "new" | null>(null);

  // Distinct speaker names actually used in the current script.
  const speakers = useMemo(() => {
    const seen = new Map<string, string>(); // lower → original
    for (const seg of script.segments) {
      if (seg.kind !== "dialogue") continue;
      const name = (seg.label || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
    // Also include declared brief speakers so users can pre-cast before writing.
    for (const s of script.brief.speakers) {
      const name = s.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [script]);

  /** Per-script overrides take precedence over the user-wide default mapping. */
  const personaById = useMemo(
    () => new Map(personas.map((p) => [p.id, p])),
    [personas],
  );
  const resolveSpeaker = (name: string): CastPersona | undefined => {
    const key = name.trim().toLowerCase();
    const local = (script.cast ?? []).find((c) => c.speaker === key);
    if (local) {
      const p = personaById.get(local.personaId);
      if (p) return p;
    }
    return castIndex.get(key);
  };

  const handleAssign = async (speaker: string, personaId: string) => {
    const cleared = personaId === "__none__";
    // Update the per-script mapping immediately so it persists with the note,
    // even if the user is offline or the global write below fails.
    onCastChange?.(speaker, cleared ? null : personaId);
    try {
      if (cleared) {
        await unassignSpeaker(speaker);
      } else {
        await assignSpeaker(speaker, personaId);
      }
      await refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to update cast");
    }
  };

  const handleDeletePersona = async (id: string) => {
    if (!confirm("Delete this persona? Any speakers using it will be uncast.")) return;
    try {
      await deletePersona(id);
      await refresh();
      toast.success("Persona removed");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to delete persona");
    }
  };

  const dialogueCount = script.segments.filter((s) => s.kind === "dialogue").length;
  const castedCount = speakers.filter((s) => !!resolveSpeaker(s)).length;

  // Don't render at all for anonymous/public users — Cast requires sign-in.
  if (signedOut) return null;

  return (
    <div className="rounded-2xl bg-sunk hairline border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Users className="h-4 w-4 ink-soft" />
        <h3 className="font-display text-sm font-semibold ink">Cast</h3>
        <span className="text-[11px] ink-faint">
          {castedCount}/{speakers.length} cast · {dialogueCount} cue{dialogueCount === 1 ? "" : "s"}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 ink-soft transition-transform",
            open ? "rotate-180" : ""
          )}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {speakers.length === 0 ? (
            <p className="text-xs ink-faint">
              No speakers yet. Add dialogue with a character name to assign a voice.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {speakers.map((speaker) => {
                const persona = resolveSpeaker(speaker);
                const lineCount = script.segments.filter(
                  (s) =>
                    s.kind === "dialogue" &&
                    (s.label || "").trim().toLowerCase() === speaker.toLowerCase()
                ).length;
                return (
                  <li
                    key={speaker}
                    className="flex items-center gap-2 rounded-lg bg-paper hairline border px-2.5 py-1.5"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide ink truncate min-w-[80px] max-w-[140px]">
                      {speaker}
                    </span>
                    <span className="text-[10px] ink-faint">
                      {lineCount} line{lineCount === 1 ? "" : "s"}
                    </span>

                    <div className="ml-auto flex items-center gap-2">
                      {persona ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ring-1 ring-inset",
                            personaColorClass(persona.color)
                          )}
                          title={persona.description || persona.name}
                        >
                          <Sparkles className="h-3 w-3" />
                          {persona.name}
                        </span>
                      ) : (
                        <span className="text-[10px] ink-faint">unassigned</span>
                      )}
                      <select
                        value={persona?.id ?? "__none__"}
                        onChange={(e) => handleAssign(speaker, e.target.value)}
                        className="text-[11px] bg-paper hairline border rounded-md px-1.5 py-1 ink-soft focus:outline-none focus:ring-1 focus:ring-foreground/30"
                      >
                        <option value="__none__">— none —</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Persona library */}
          <div className="pt-2 border-t hairline">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] uppercase tracking-wider ink-soft font-semibold">
                Personas
              </span>
              <span className="text-[10px] ink-faint">
                {personas.length} saved
              </span>
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium hairline border bg-paper ink-soft hover:bg-sunk transition-smooth"
              >
                <UserPlus className="h-3 w-3" /> New persona
              </button>
            </div>

            {loading ? (
              <p className="text-[11px] ink-faint">Loading…</p>
            ) : personas.length === 0 ? (
              <p className="text-[11px] ink-faint">
                Create a persona once and reuse it across every script.
              </p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {personas.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start gap-2 rounded-lg bg-paper hairline border px-2.5 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ring-1 ring-inset",
                            personaColorClass(p.color)
                          )}
                        >
                          {p.name}
                        </span>
                        {p.gender !== "unspecified" && (
                          <span className="text-[10px] ink-faint">{p.gender}</span>
                        )}
                        {p.age_range && (
                          <span className="text-[10px] ink-faint">· {p.age_range}</span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-[11px] ink-soft mt-0.5 line-clamp-2">
                          {p.description}
                        </p>
                      )}
                      {p.tone_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.tone_tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-sunk ink-soft"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md ink-soft hover:bg-sunk"
                        title="Edit persona"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePersona(p.id)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md text-rose-600 hover:bg-rose-500/10"
                        title="Delete persona"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {editing && (
        <PersonaEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// PersonaEditor — modal-ish overlay for create/update
// ============================================================================

function PersonaEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: CastPersona | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<PersonaInput>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    accent: initial?.accent ?? "",
    age_range: initial?.age_range ?? "adult",
    gender: initial?.gender ?? "unspecified",
    sample_line: initial?.sample_line ?? "",
    tone_tags: initial?.tone_tags ?? [],
    color: initial?.color ?? "neutral",
  });
  const [busy, setBusy] = useState(false);

  const toggleTag = (t: string) => {
    setDraft((d) => {
      const have = (d.tone_tags ?? []).includes(t);
      return {
        ...d,
        tone_tags: have
          ? (d.tone_tags ?? []).filter((x) => x !== t)
          : [...(d.tone_tags ?? []), t],
      };
    });
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Persona needs a name");
      return;
    }
    try {
      setBusy(true);
      if (initial) {
        await updatePersona(initial.id, draft);
        toast.success("Persona updated");
      } else {
        await createPersona(draft);
        toast.success("Persona created");
      }
      onSaved();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to save persona");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 safe-overlay z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-paper hairline border shadow-xl p-4 space-y-3 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 ink-soft" />
          <h3 className="font-display text-sm font-semibold ink">
            {initial ? "Edit persona" : "New persona"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md ink-soft hover:bg-sunk"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <div className="text-[11px] ink-soft mb-1">Name *</div>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Warm Narrator"
            className="w-full text-sm bg-sunk hairline border rounded-md px-2 py-1.5 ink focus:outline-none focus:ring-1 focus:ring-foreground/30"
          />
        </label>

        <label className="block">
          <div className="text-[11px] ink-soft mb-1">Description</div>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="A few words on delivery, vibe, age, accent…"
            rows={2}
            className="w-full text-sm bg-sunk hairline border rounded-md px-2 py-1.5 ink focus:outline-none focus:ring-1 focus:ring-foreground/30 resize-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <div className="text-[11px] ink-soft mb-1">Gender</div>
            <select
              value={draft.gender}
              onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
              className="w-full text-sm bg-sunk hairline border rounded-md px-2 py-1.5 ink"
            >
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-[11px] ink-soft mb-1">Age range</div>
            <select
              value={draft.age_range}
              onChange={(e) => setDraft({ ...draft, age_range: e.target.value })}
              className="w-full text-sm bg-sunk hairline border rounded-md px-2 py-1.5 ink"
            >
              {AGE_RANGES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <div className="text-[11px] ink-soft mb-1">Accent / origin</div>
          <input
            value={draft.accent}
            onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
            placeholder="e.g. London, Midwestern, neutral"
            className="w-full text-sm bg-sunk hairline border rounded-md px-2 py-1.5 ink focus:outline-none focus:ring-1 focus:ring-foreground/30"
          />
        </label>

        <div>
          <div className="text-[11px] ink-soft mb-1">Tone</div>
          <div className="flex flex-wrap gap-1">
            {SUGGESTED_TONE_TAGS.map((t) => {
              const active = (draft.tone_tags ?? []).includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border transition-smooth",
                    active
                      ? "bg-foreground text-background border-transparent"
                      : "hairline border bg-paper ink-soft hover:bg-sunk"
                  )}
                >
                  {active && <Check className="h-2.5 w-2.5 inline mr-0.5" />}
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <div className="text-[11px] ink-soft mb-1">Sample line</div>
          <input
            value={draft.sample_line}
            onChange={(e) => setDraft({ ...draft, sample_line: e.target.value })}
            placeholder="A line that shows off this voice"
            className="w-full text-sm bg-sunk hairline border rounded-md px-2 py-1.5 ink focus:outline-none focus:ring-1 focus:ring-foreground/30"
          />
        </label>

        <div>
          <div className="text-[11px] ink-soft mb-1">Color</div>
          <div className="flex gap-1.5">
            {PERSONA_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft({ ...draft, color: c })}
                className={cn(
                  "h-6 w-6 rounded-full ring-2 transition-smooth",
                  personaColorClass(c).split(" ").filter((cls) => cls.startsWith("bg-")).join(" "),
                  draft.color === c
                    ? "ring-foreground"
                    : "ring-transparent hover:ring-foreground/30"
                )}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] ink-soft hover:ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-foreground text-background hover:opacity-90 transition-smooth disabled:opacity-50"
          >
            {busy ? "Saving…" : initial ? "Save changes" : "Create persona"}
          </button>
        </div>
      </div>
    </div>
  );
}
