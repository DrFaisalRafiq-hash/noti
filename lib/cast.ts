// ============================================================================
// Cast: reusable voice personas + per-speaker mappings
// ----------------------------------------------------------------------------
// CRUD against the `cast_personas` and `script_cast` tables. Everything is
// scoped per user via RLS — these helpers just call .select/.insert/.update.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export interface CastPersona {
  id: string;
  user_id: string;
  name: string;
  description: string;
  accent: string;
  age_range: string;
  gender: string;
  sample_line: string;
  tone_tags: string[];
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ScriptCastRow {
  id: string;
  user_id: string;
  speaker_name: string;
  persona_id: string;
}

export type PersonaInput = Partial<
  Omit<CastPersona, "id" | "user_id" | "created_at" | "updated_at">
> & { name: string };

export const PERSONA_COLORS = [
  "neutral",
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
  "fuchsia",
] as const;

export const AGE_RANGES = ["child", "teen", "young", "adult", "middle", "senior"] as const;
export const GENDERS = ["unspecified", "feminine", "masculine", "non-binary"] as const;

export const SUGGESTED_TONE_TAGS = [
  "warm",
  "energetic",
  "calm",
  "authoritative",
  "playful",
  "gravelly",
  "bright",
  "deadpan",
  "anxious",
  "sultry",
  "weary",
  "chipper",
];

export async function listPersonas(): Promise<CastPersona[]> {
  const { data, error } = await supabase
    .from("cast_personas")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CastPersona[];
}

export async function createPersona(input: PersonaInput): Promise<CastPersona> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("cast_personas")
    .insert({
      user_id: uid,
      name: input.name,
      description: input.description ?? "",
      accent: input.accent ?? "",
      age_range: input.age_range ?? "adult",
      gender: input.gender ?? "unspecified",
      sample_line: input.sample_line ?? "",
      tone_tags: input.tone_tags ?? [],
      color: input.color ?? "neutral",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CastPersona;
}

export async function updatePersona(id: string, patch: Partial<PersonaInput>) {
  const { error } = await supabase.from("cast_personas").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePersona(id: string) {
  const { error } = await supabase.from("cast_personas").delete().eq("id", id);
  if (error) throw error;
}

export async function listCast(): Promise<ScriptCastRow[]> {
  const { data, error } = await supabase.from("script_cast").select("*");
  if (error) throw error;
  return (data ?? []) as ScriptCastRow[];
}

/** Upsert a speaker→persona assignment (case-insensitive on speaker_name). */
export async function assignSpeaker(speakerName: string, personaId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in");

  // Delete existing mapping for this speaker first (case-insensitive),
  // then insert the new one. Avoids relying on a multi-column upsert key.
  const { error: delErr } = await supabase
    .from("script_cast")
    .delete()
    .eq("user_id", uid)
    .ilike("speaker_name", speakerName);
  if (delErr) throw delErr;

  const { error } = await supabase.from("script_cast").insert({
    user_id: uid,
    speaker_name: speakerName,
    persona_id: personaId,
  });
  if (error) throw error;
}

export async function unassignSpeaker(speakerName: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("script_cast")
    .delete()
    .eq("user_id", uid)
    .ilike("speaker_name", speakerName);
  if (error) throw error;
}

/** Build a lookup: lowercased speaker name → persona. */
export function buildCastIndex(
  cast: ScriptCastRow[],
  personas: CastPersona[]
): Map<string, CastPersona> {
  const personaById = new Map(personas.map((p) => [p.id, p]));
  const out = new Map<string, CastPersona>();
  for (const row of cast) {
    const p = personaById.get(row.persona_id);
    if (p) out.set(row.speaker_name.toLowerCase(), p);
  }
  return out;
}

/** Visual classes for a persona color chip (uses Tailwind palette directly,
 *  intentionally — these are visualization tokens, not theme colors). */
export function personaColorClass(color: string): string {
  switch (color) {
    case "rose":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/30";
    case "amber":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30";
    case "emerald":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30";
    case "sky":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30";
    case "violet":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30";
    case "fuchsia":
      return "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-fuchsia-500/30";
    case "neutral":
    default:
      return "bg-foreground/10 ink ring-foreground/20";
  }
}
