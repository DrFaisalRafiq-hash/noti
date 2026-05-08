import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PublishBody {
  voice_memo_id: string;
  title: string;
  description?: string;
  script_note_id?: string | null;
  explicit?: boolean;
  author?: string;
  author_email?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = (await req.json()) as PublishBody;
    if (!body?.voice_memo_id || !body?.title || body.title.trim().length < 2) {
      return json({ error: "voice_memo_id and title are required" }, 400);
    }

    // 1. Load podcast settings (per user)
    const { data: settingsRow, error: settingsErr } = await supabase
      .from("podcast_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (settingsErr) throw settingsErr;
    if (!settingsRow?.api_key || !settingsRow?.show_id) {
      return json(
        { error: "Add your RSS.com API key and Podcast ID in Settings → Podcast publishing first." },
        400,
      );
    }

    // 2. Load the voice memo
    const { data: memo, error: memoErr } = await supabase
      .from("voice_memos")
      .select("*")
      .eq("id", body.voice_memo_id)
      .maybeSingle();
    if (memoErr) throw memoErr;
    if (!memo?.url) return json({ error: "Voice memo not found" }, 404);

    // 3. Insert pending publication row
    const { data: pubRow, error: pubErr } = await supabase
      .from("episode_publications")
      .insert({
        user_id: userId,
        voice_memo_id: memo.id,
        script_note_id: body.script_note_id ?? null,
        host: settingsRow.host ?? "rsscom",
        title: body.title.trim().slice(0, 200),
        description: body.description?.slice(0, 4000) ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (pubErr) throw pubErr;

    // 4. Fetch the audio so we can hand it off as multipart
    const audioRes = await fetch(memo.url);
    if (!audioRes.ok) {
      const msg = `Couldn't fetch audio (${audioRes.status})`;
      await supabase
        .from("episode_publications")
        .update({ status: "failed", error: msg })
        .eq("id", pubRow.id);
      return json({ error: msg }, 502);
    }
    const audioBlob = await audioRes.blob();

    // 5. POST to RSS.com
    // Their public API root is https://api.rss.com/v1
    // Endpoint convention: POST /podcasts/{podcast_id}/episodes  (multipart/form-data)
    const form = new FormData();
    form.append("title", body.title.trim());
    if (body.description) form.append("description", body.description);
    form.append("explicit", String(!!(body.explicit ?? settingsRow.default_explicit)));
    if (body.author ?? settingsRow.default_author) {
      form.append("author", body.author ?? settingsRow.default_author);
    }
    form.append("audio", audioBlob, `episode-${memo.id}.${guessExt(memo.mime_type)}`);

    const rssUrl = `https://api.rss.com/v1/podcasts/${settingsRow.show_id}/episodes`;
    const rssRes = await fetch(rssUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${settingsRow.api_key}` },
      body: form,
    });

    const rssText = await rssRes.text();
    let rssJson: Record<string, unknown> | null = null;
    try {
      rssJson = JSON.parse(rssText);
    } catch {
      rssJson = null;
    }

    if (!rssRes.ok) {
      const errMsg =
        (rssJson && (rssJson.message as string | undefined)) ||
        rssText.slice(0, 300) ||
        `RSS.com error ${rssRes.status}`;
      await supabase
        .from("episode_publications")
        .update({
          status: "failed",
          error: errMsg,
          payload: { http_status: rssRes.status, response: rssJson ?? rssText },
        })
        .eq("id", pubRow.id);
      return json({ error: errMsg, status: rssRes.status }, 502);
    }

    const remoteId =
      (rssJson?.id as string | number | undefined)?.toString() ??
      (rssJson?.episode_id as string | undefined) ??
      null;
    const remoteUrl =
      (rssJson?.url as string | undefined) ??
      (rssJson?.episode_url as string | undefined) ??
      null;

    await supabase
      .from("episode_publications")
      .update({
        status: "uploaded",
        remote_episode_id: remoteId,
        remote_url: remoteUrl,
        payload: { response: rssJson },
      })
      .eq("id", pubRow.id);

    return json({
      ok: true,
      publication_id: pubRow.id,
      remote_episode_id: remoteId,
      remote_url: remoteUrl,
    });
  } catch (err: unknown) {
    console.error("publish-episode-rsscom", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function guessExt(mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "webm";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
