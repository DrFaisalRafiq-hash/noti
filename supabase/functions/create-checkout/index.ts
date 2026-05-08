// Creates a Stripe Checkout Session for a credit top-up.
// Body: { pack: 'credits_5'|'credits_20'|'credits_50' } OR { custom_usd: number }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireUser, adminClient, CREDITS_PER_USD } from "../_shared/wallet.ts";

const STRIPE_GATEWAY = "https://connector-gateway.lovable.dev/stripe/v1";

const PACKS: Record<string, { usd: number; credits: number; label: string }> = {
  credits_5:  { usd: 5,  credits: 500,   label: "500 AI Credits" },
  credits_20: { usd: 20, credits: 2200,  label: "2,200 AI Credits" },
  credits_50: { usd: 50, credits: 6000,  label: "6,000 AI Credits" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const userId = await requireUser(req);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const STRIPE_KEY = Deno.env.get("STRIPE_SANDBOX_API_KEY") ?? Deno.env.get("STRIPE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!STRIPE_KEY) throw new Error("STRIPE_SANDBOX_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const origin = req.headers.get("origin") ?? "https://noti-time.com";

    let usdCents: number;
    let credits: number;
    let label: string;

    if (body.pack && PACKS[body.pack as string]) {
      const p = PACKS[body.pack as string];
      usdCents = p.usd * 100;
      credits = p.credits;
      label = p.label;
    } else if (typeof body.custom_usd === "number" && body.custom_usd >= 5 && body.custom_usd <= 500) {
      const usd = Math.floor(body.custom_usd);
      usdCents = usd * 100;
      credits = usd * CREDITS_PER_USD; // flat rate, no bonus on custom
      label = `${credits.toLocaleString()} AI Credits`;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid pack or custom amount (min $5, max $500)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Stripe checkout session via gateway (form-encoded)
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${origin}/app?topup=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/app?topup=cancel`);
    params.set("client_reference_id", userId);
    params.set("metadata[user_id]", userId);
    params.set("metadata[credits]", String(credits));
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][product_data][name]", label);
    params.set("line_items[0][price_data][unit_amount]", String(usdCents));
    params.set("line_items[0][quantity]", "1");
    params.set("payment_intent_data[metadata][user_id]", userId);
    params.set("payment_intent_data[metadata][credits]", String(credits));

    const stripeRes = await fetch(`${STRIPE_GATEWAY}/checkout/sessions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": STRIPE_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error("stripe create session:", stripeRes.status, session);
      throw new Error(session?.error?.message ?? "Stripe checkout failed");
    }

    // Record pending session
    const sb = adminClient();
    await sb.from("stripe_checkout_sessions").insert({
      id: session.id,
      user_id: userId,
      credits,
      usd_amount: (usdCents / 100).toFixed(2),
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
