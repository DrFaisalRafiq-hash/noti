import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Subscribe / unsubscribe a device for web push.
// Single-user app: keyed on device_id (the same id used by notes/folders).
//
// POST /push-subscribe
//   { action: 'subscribe', device_id, subscription: { endpoint, keys: { p256dh, auth } }, user_agent? }
//   { action: 'unsubscribe', device_id }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // GET returns the VAPID public key so the client can call pushManager.subscribe.
  if (req.method === "GET") {
    return json({ vapid_public_key: Deno.env.get("VAPID_PUBLIC_KEY") ?? null });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const deviceId = (body.device_id || "").toString().trim();
    if (!deviceId) {
      return json({ error: "device_id required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "unsubscribe") {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ enabled: false })
        .eq("device_id", deviceId);
      if (error) throw error;
      return json({ ok: true });
    }

    // Update only the strong_alerts pref without re-subscribing.
    if (action === "set_prefs") {
      const strong = body.strong_alerts !== false; // default true
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ strong_alerts: strong, last_seen_at: new Date().toISOString() })
        .eq("device_id", deviceId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action !== "subscribe") {
      return json({ error: "unknown action" }, 400);
    }

    const sub = body.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return json({ error: "invalid subscription" }, 400);
    }

    const strongAlerts = body.strong_alerts !== false; // default true

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        device_id: deviceId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: body.user_agent ?? null,
        enabled: true,
        strong_alerts: strongAlerts,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    );
    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    console.error("[push-subscribe]", err);
    return json({ error: (err as Error).message ?? "unknown" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
