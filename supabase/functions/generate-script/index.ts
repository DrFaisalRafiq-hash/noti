import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  requireUser,
  ensureCanSpend,
  chargeForCall,
  paywallError,
} from "../_shared/wallet.ts";

const MODEL = "google/gemini-3-flash-preview";

interface Brief {
  topic: string;
  lengthMin: number;
  tone: string;
  speakers: string[];
  talkingPoints: string[];
  notes?: string;
  sourceText?: string; // optional existing-note brief
  logline?: string;
  genre?: string;
}

type ScriptKind = "podcast" | "screenplay" | "comic";
type ScriptFormat = "segmented" | "dialogue" | "screenplay" | "teleplay" | "stageplay" | "comic";

const SEGMENT_KINDS = [
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
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await requireUser(req);
    await ensureCanSpend(userId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const action: "generate" | "regenerate_segment" | "compile_outline" = body.action ?? "generate";
    const validFormats: ScriptFormat[] = ["segmented", "dialogue", "screenplay", "teleplay", "stageplay", "comic"];
    const format: ScriptFormat = validFormats.includes(body.format) ? body.format : "segmented";
    const kind: ScriptKind =
      body.kind === "comic" || format === "comic"
        ? "comic"
        : body.kind === "screenplay" || ["screenplay", "teleplay", "stageplay"].includes(format)
        ? "screenplay"
        : "podcast";
    const brief: Brief = body.brief ?? {};

    if (action !== "compile_outline" && !brief.topic && !brief.sourceText && !brief.logline) {
      return new Response(JSON.stringify({ error: "Provide a topic, logline, or source text." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const speakerCap = kind === "podcast" ? 4 : 8;
    const speakers = (brief.speakers && brief.speakers.length
      ? brief.speakers
      : kind === "screenplay"
      ? ["PROTAGONIST"]
      : kind === "comic"
      ? ["HERO"]
      : ["Host"]
    ).slice(0, speakerCap);
    const lengthMin = Math.max(1, Math.min(180, Number(brief.lengthMin) || 15));

    let messages: any[];
    let tools: any[];
    let toolName: string;

    if (action === "compile_outline") {
      toolName = "compile_script";
      const outlineSegments = Array.isArray(body.segments) ? body.segments : [];
      if (!outlineSegments.length) {
        return new Response(JSON.stringify({ error: "No outline segments to compile." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const compileGuide =
        kind === "comic"
          ? `Expand each outline beat into a properly-formatted comic book script. ` +
            `Group panels under kind="page" anchors (label "Page N"). For each page, emit several kind="panel" ` +
            `descriptions (visual, present-tense, 2–4 sentences). Place kind="caption" for narration, ` +
            `kind="dialogue" with CHARACTER labels for spoken lines, and kind="sfx" for sound effects (CAPS). ` +
            `Aim for ~${lengthMin} pages with 4–6 panels per page. Preserve the outline's intent and ordering. ` +
            `Do not set durationSec.`
          : kind === "screenplay"
          ? `Expand each outline beat into properly formatted screenplay segments. ` +
            `For every outline beat, emit (in order): an optional scene_heading if the location/time changes, ` +
            `action prose describing what we see, dialogue lines with CHARACTER labels in uppercase, ` +
            `and short parentheticals (kind="direction") only when needed. Use transitions sparingly. ` +
            `Preserve the outline's intent and ordering. Do not invent contradictory plot. Do not set durationSec.`
          : `Expand each outline beat into a complete podcast script with full speaking cues. ` +
            `Keep section headers (kind="section") as anchors and follow each with multiple kind="dialogue" lines ` +
            `spoken by ${speakers.join(", ")} that fully voice the beat — not bullet points, not summaries. ` +
            `Insert kind="direction" cues for music, SFX, pauses, and transitions where appropriate ` +
            `(e.g. "(theme music swells, then under)", "(pause)", "(SFX: door slam)"). ` +
            `Preserve the outline's order and intent. Aim for ~${lengthMin} minutes total runtime ` +
            `and provide realistic durationSec on each segment. ` +
            `If a beat already contains finished dialogue, keep its meaning but polish for spoken delivery.`;

      const outlineJson = JSON.stringify(
        outlineSegments.slice(0, 80).map((s: any) => ({
          kind: s.kind,
          label: s.label,
          text: typeof s.text === "string" ? s.text.slice(0, 1200) : "",
        }))
      );

      messages = [
        {
          role: "system",
          content:
            (kind === "screenplay"
              ? `You are a produced screenwriter compiling a writer's outline into a shootable ${format}.`
              : `You are a senior podcast script writer compiling a writer's outline into a ready-to-record script.`) +
            ` Tone: ${brief.tone}. Speakers/Characters: ${speakers.join(", ")}. ` +
            ` Topic: ${brief.topic || brief.logline || "(see outline)"}. ` +
            compileGuide +
            ` Output ONLY via the tool call.`,
        },
        {
          role: "user",
          content: `Outline to compile (ordered):\n${outlineJson}`,
        },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: toolName,
            description:
              "Return the fully compiled script as ordered segments, expanded from the provided outline.",
            parameters: {
              type: "object",
              properties: {
                segments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: SEGMENT_KINDS as unknown as string[] },
                      label: { type: "string" },
                      text: { type: "string" },
                      durationSec: { type: "number" },
                    },
                    required: ["kind", "text"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["segments"],
              additionalProperties: false,
            },
          },
        },
      ];
    } else if (action === "regenerate_segment") {
      const seg = body.segment ?? {};
      const direction = String(body.direction ?? "Improve this segment, keep the same intent.");
      toolName = "rewrite_segment";
      const writerRole =
        kind === "screenplay"
          ? `You rewrite a single ${format} script segment. Keep the same character/label and segment kind. ` +
            `Match the genre/tone (${brief.tone}) and story (${brief.topic || brief.logline || ""}). ` +
            `For dialogue, keep character voice consistent. For action, write present tense, visual, no camera directions.`
          : `You rewrite a single segment of a podcast script. Keep the same speaker label and segment kind. ` +
            `Match the show's tone (${brief.tone}) and overall topic (${brief.topic}).`;
      messages = [
        {
          role: "system",
          content: `${writerRole} Apply the user's direction. Output ONLY via the tool call.`,
        },
        {
          role: "user",
          content: JSON.stringify({ brief, segment: seg, direction, format, kind }),
        },
      ];
      tools = [
        {
          type: "function",
          function: {
            name: toolName,
            description: "Return one rewritten script segment.",
            parameters: {
              type: "object",
              properties: {
                kind: { type: "string", enum: SEGMENT_KINDS as unknown as string[] },
                label: { type: "string" },
                text: { type: "string" },
                durationSec: { type: "number" },
              },
              required: ["kind", "text"],
              additionalProperties: false,
            },
          },
        },
      ];
    } else {
      toolName = "compose_script";

      let formatGuide: string;
      if (kind === "comic") {
        formatGuide =
          `Format: COMIC BOOK SCRIPT in standard "full script" (Image / Marvel) style. ` +
          `Aim for roughly ${lengthMin} pages, with 4–6 panels per page on average. ` +
          `Use these segment kinds in order: ` +
          `kind="page" with label like "Page 1" (use text for an optional splash/page summary). ` +
          `kind="panel" — describe the panel: composition, framing, characters present, action, mood. Keep it visual and concrete. ` +
          `kind="caption" for narration or text-box copy (text is the caption content). ` +
          `kind="dialogue" with label = CHARACTER NAME (uppercase) and text = the spoken line. Add "(off-panel)" or "(whispered)" inside the line if needed. ` +
          `kind="direction" for short bracketed beats like "(whispered)" tied to a dialogue line. ` +
          `kind="sfx" for sound effects (text in CAPS, e.g. "KRAKOOM!", "thwip"). ` +
          `Always start a new page with kind="page", then list its panels in order. ` +
          `Do NOT include durationSec. Keep panel descriptions tight (2–4 sentences each).`;
      } else if (kind === "screenplay") {
        const lengthHint =
          format === "stageplay"
            ? `Aim for roughly ${lengthMin} minutes of stage time.`
            : `Aim for roughly ${lengthMin} pages (~${lengthMin} minutes of screen time).`;
        const formatName =
          format === "teleplay" ? "TELEPLAY (TV)" : format === "stageplay" ? "STAGE PLAY" : "FEATURE / SHORT FILM SCREENPLAY";
        formatGuide =
          `Format: ${formatName} in standard industry style. ${lengthHint} ` +
          `Use these segment kinds in order: ` +
          `kind="scene_heading" with label like "INT. KITCHEN — NIGHT" (uppercase slug, blank text OK). ` +
          `kind="action" for visual, present-tense action/description prose (no camera directions unless essential). ` +
          `kind="dialogue" with label = CHARACTER NAME (uppercase) and text = the spoken line. ` +
          `kind="direction" for short parentheticals like "(whispering)" — use sparingly, max ~6 words. ` +
          `kind="transition" for "CUT TO:", "SMASH CUT TO:", "FADE OUT." — use sparingly. ` +
          `Open with FADE IN: as a transition or a strong scene heading. End with FADE OUT. ` +
          `Write characters with distinct voices. Build a clear arc: setup → conflict → climax → resolution. ` +
          `Do NOT set durationSec for screenplay segments.`;
      } else if (format === "dialogue") {
        formatGuide =
          `Format: line-by-line DIALOGUE between speakers (${speakers.join(", ")}). ` +
          `Use kind="dialogue" for spoken lines (label = speaker name). ` +
          `Use kind="section" sparingly for structural beats (Cold open, Main, Outro). ` +
          `Use kind="direction" for stage cues like "music swells".`;
      } else {
        formatGuide =
          `Format: SEGMENTED outline. ` +
          `Use kind="section" for each labeled beat (e.g. "Cold open", "Segment 1: …", "Sponsor", "Outro"). ` +
          `Inside each section, follow with kind="dialogue" lines spoken by ${speakers.join(", ")} that flesh out the content. ` +
          `Use kind="direction" for stage cues. Aim for tight, performable prose, not bullet points.`;
      }

      const sourceBlock = brief.sourceText
        ? `\n\nSource brief from the user's existing note:\n"""${brief.sourceText.slice(0, 6000)}"""`
        : "";
      const pointsBlock = brief.talkingPoints?.length
        ? `\n\n${kind === "screenplay" ? "Story beats / plot points" : "Talking points"} to cover:\n- ${brief.talkingPoints.join("\n- ")}`
        : "";
      const notesBlock = brief.notes ? `\n\nExtra direction: ${brief.notes}` : "";
      const loglineBlock = brief.logline ? `\n\nLogline: ${brief.logline}` : "";
      const genreBlock = brief.genre ? `\n\nGenre: ${brief.genre}` : "";

      const writerPersona =
        kind === "comic"
          ? `You are a published comic book writer. Compose a complete, properly-formatted comic book script. ` +
            `Tone/genre: ${brief.tone}. ` +
            `Characters: ${speakers.join(", ")}. ` +
            `Provide a complete, satisfying short story arc — not a treatment. ` +
            `Do not include durationSec. Do not include preamble — output ONLY via the tool call.`
          : kind === "screenplay"
          ? `You are a produced screenwriter. Compose a complete, properly-formatted ${format} ready for a script reader. ` +
            `Tone/genre: ${brief.tone}. ` +
            `Characters: ${speakers.join(", ")}. ` +
            `Provide a complete, satisfying short piece — not a treatment. ` +
            `Do not include durationSec. Do not include preamble — output ONLY via the tool call.`
          : `You are a senior podcast script writer. Compose a complete, ready-to-record podcast script. ` +
            `Tone: ${brief.tone}. Target length: ~${lengthMin} minutes. ` +
            `Speakers: ${speakers.join(", ")}. ` +
            `Provide realistic durationSec estimates. Do not include preamble — output ONLY via the tool call.`;

      messages = [
        { role: "system", content: writerPersona + " " + formatGuide },
        {
          role: "user",
          content:
            `Topic: ${brief.topic || "(see logline / source brief)"}${loglineBlock}${genreBlock}${pointsBlock}${notesBlock}${sourceBlock}`,
        },
      ];
      tools = [
        {
          type: "function",
          function: {
            name: toolName,
            description:
              kind === "screenplay"
                ? "Return a complete screenplay/teleplay/stageplay as ordered segments."
                : "Return the complete podcast script as structured segments.",
            parameters: {
              type: "object",
              properties: {
                segments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: SEGMENT_KINDS as unknown as string[] },
                      label: { type: "string" },
                      text: { type: "string" },
                      durationSec: { type: "number" },
                    },
                    required: ["kind", "text"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["segments"],
              additionalProperties: false,
            },
          },
        },
      ];
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools,
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!r.ok) return aiError(r);
    const data = await r.json();

    const usage = data.usage ?? {};
    const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;

    const charge = await chargeForCall({
      userId,
      feature: `script:${action}`,
      model: MODEL,
      inputTokens,
      outputTokens,
    });

    const argsRaw = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const args = argsRaw ? JSON.parse(argsRaw) : {};

    return new Response(
      JSON.stringify({ ...args, _charged_credits: charge.credits }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const pw = paywallError(e);
    if (pw) return pw;
    console.error("generate-script error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function aiError(r: Response) {
  if (r.status === 429) {
    return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (r.status === 402) {
    return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const t = await r.text();
  console.error("AI gateway:", r.status, t);
  return new Response(JSON.stringify({ error: "AI request failed" }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
