import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  requireUser,
  ensureCanSpend,
  chargeForCall,
  paywallError,
} from "../_shared/wallet.ts";

const ACTIONS: Record<string, string> = {
  expand:
    "Expand and enrich this note into a clearer, fuller version. Keep the user's voice. Output ONLY the rewritten note text — no preface, no quotes.",
  improve:
    "Improve the writing of this text: fix grammar, tighten phrasing, and clarify meaning while keeping the original intent and voice. Output ONLY the rewritten text — no preface, no quotes.",
  shorten:
    "Shorten this text while preserving the key meaning. Aim for ~50% of the original length. Output ONLY the shortened text — no preface, no quotes.",
  continue:
    "Continue writing from where this text leaves off, in the same tone and style. Add 1-3 natural sentences. Output ONLY the new continuation text (do NOT repeat the original) — no preface, no quotes.",
  summarize:
    "Summarize this note into 2-3 concise bullet points. Output ONLY the bullets as plain text, one per line, prefixed with '• '.",
  rewrite_concise:
    "Rewrite this note to be tight and concise while keeping all key info. Output ONLY the rewritten text.",
  rewrite_formal:
    "Rewrite this note in a formal, professional tone. Output ONLY the rewritten text.",
  rewrite_casual:
    "Rewrite this note in a friendly, casual tone. Output ONLY the rewritten text.",
  title:
    "Write a short, descriptive title for this note. Rules: 3-7 words, Title Case, no trailing punctuation, no quotes, no emoji, no preface. Output ONLY the title on a single line.",
};

const MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await requireUser(req);
    await ensureCanSpend(userId);

    const { action, text, folders } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    let feature = action as string;

    if (action === "categorize") {
      const folderList = Array.isArray(folders) ? folders.filter((f) => typeof f === "string") : [];
      body = {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You categorize short personal notes. Pick the single best folder for the note. If an existing folder fits, reuse it. Otherwise propose a new short folder name (1-2 words, Title Case). Also produce a short category label and 1-3 lowercase tags.",
          },
          {
            role: "user",
            content: `Existing folders: ${folderList.length ? folderList.join(", ") : "(none)"}\n\nNote:\n${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "categorize_note",
              description: "Return folder + category + tags for a note.",
              parameters: {
                type: "object",
                properties: {
                  folder: { type: "string" },
                  is_new_folder: { type: "boolean" },
                  category: { type: "string" },
                  tags: { type: "array", items: { type: "string" }, maxItems: 3 },
                },
                required: ["folder", "is_new_folder", "category", "tags"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "categorize_note" } },
      };
    } else {
      const sys = ACTIONS[action];
      if (!sys) {
        return new Response(JSON.stringify({ error: "unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      body = {
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: text },
        ],
      };
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return aiError(r);
    const data = await r.json();

    const usage = data.usage ?? {};
    const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;

    // Charge AFTER successful AI call
    const charge = await chargeForCall({
      userId,
      feature: `note-ai:${feature}`,
      model: MODEL,
      inputTokens,
      outputTokens,
    });

    let payload: any;
    if (action === "categorize") {
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      payload = args ? JSON.parse(args) : {};
    } else {
      payload = { result: data.choices?.[0]?.message?.content ?? "" };
    }

    return new Response(
      JSON.stringify({ ...payload, _charged_credits: charge.credits }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const pw = paywallError(e);
    if (pw) return pw;
    console.error("note-ai error:", e);
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
    return new Response(
      JSON.stringify({ error: "Service temporarily unavailable." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const t = await r.text();
  console.error("AI gateway:", r.status, t);
  return new Response(JSON.stringify({ error: "AI request failed" }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
