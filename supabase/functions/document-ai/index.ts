// Analyze a document with AI: returns summary, suggested folder, category, and tags.
// Charges the user's wallet via the shared helpers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  requireUser,
  ensureCanSpend,
  chargeForCall,
  paywallError,
  adminClient,
} from "../_shared/wallet.ts";

const MODEL = "google/gemini-2.5-flash";
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB cap for inline analysis
const TEXT_CHAR_LIMIT = 60_000;

function isTextLike(mime: string): boolean {
  if (!mime) return false;
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime === "application/csv"
  );
}
function isImage(mime: string) {
  return mime?.startsWith("image/");
}
function isPdf(mime: string) {
  return mime === "application/pdf";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await requireUser(req);
    await ensureCanSpend(userId);

    const { document_id, folders } = await req.json();
    if (!document_id || typeof document_id !== "string") {
      return new Response(JSON.stringify({ error: "document_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = adminClient();

    // Look up the document row
    const { data: doc, error: docErr } = await sb
      .from("documents")
      .select("id, file_name, mime_type, size_bytes, storage_path")
      .eq("id", document_id)
      .maybeSingle();
    if (docErr) throw docErr;
    if (!doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (doc.size_bytes && doc.size_bytes > MAX_BYTES) {
      return new Response(
        JSON.stringify({
          error: `File is too large for AI analysis (limit ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Download file from storage
    const { data: blob, error: dlErr } = await sb.storage
      .from("documents")
      .download(doc.storage_path);
    if (dlErr || !blob) {
      return new Response(JSON.stringify({ error: "Couldn't read the document file." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const folderList: string[] = Array.isArray(folders)
      ? folders.filter((f: unknown) => typeof f === "string")
      : [];

    const sysPrompt =
      "You analyze user documents and return a concise summary and the best filing metadata. " +
      "Pick the single best folder for the document. If an existing folder fits, REUSE it exactly. " +
      "Otherwise propose a short new folder name (1-2 words, Title Case). " +
      "Also produce: a short category label, 2-5 lowercase tags, and a 2-4 sentence summary the user can scan quickly.";

    const tools = [
      {
        type: "function",
        function: {
          name: "analyze_document",
          description: "Return summary + folder + category + tags for a document.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "2-4 sentence plain-text summary." },
              folder: { type: "string" },
              is_new_folder: { type: "boolean" },
              category: { type: "string" },
              tags: { type: "array", items: { type: "string" }, maxItems: 5 },
            },
            required: ["summary", "folder", "is_new_folder", "category", "tags"],
            additionalProperties: false,
          },
        },
      },
    ];

    const folderHint = `Existing folders: ${folderList.length ? folderList.join(", ") : "(none)"}\nFile name: ${doc.file_name}\nMime type: ${doc.mime_type}`;

    let userContent: any;

    if (isTextLike(doc.mime_type)) {
      const text = (await blob.text()).slice(0, TEXT_CHAR_LIMIT);
      userContent = `${folderHint}\n\nDocument contents:\n${text}`;
    } else if (isImage(doc.mime_type) || isPdf(doc.mime_type)) {
      // Encode as base64 data URL for multimodal input
      const buf = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      const b64 = btoa(binary);
      const dataUrl = `data:${doc.mime_type};base64,${b64}`;
      userContent = [
        { type: "text", text: folderHint },
        { type: "image_url", image_url: { url: dataUrl } },
      ];
    } else {
      // Fallback: just metadata
      userContent = `${folderHint}\n\n(The file contents are in a binary format that can't be read directly. Use the file name and mime type to suggest a category, tags, and folder.)`;
    }

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userContent },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "analyze_document" } },
    };

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      if (r.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (r.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
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

    const data = await r.json();
    const usage = data.usage ?? {};
    const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;

    const charge = await chargeForCall({
      userId,
      feature: "document-ai:analyze",
      model: MODEL,
      inputTokens,
      outputTokens,
      metadata: { document_id, mime_type: doc.mime_type, size_bytes: doc.size_bytes },
    });

    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : {};

    return new Response(
      JSON.stringify({ ...parsed, _charged_credits: charge.credits }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const pw = paywallError(e);
    if (pw) return pw;
    console.error("document-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
