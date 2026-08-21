import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiGate, logAiUsage } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth gate: require a valid signed-in user (prevents anonymous AI cost abuse) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let body: { title?: unknown; type?: unknown; existingItems?: unknown };
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const type = body.type;
    const existingItems = Array.isArray(body.existingItems) ? body.existingItems : [];

    // ── Cheap input validation before hitting the AI gateway ──
    if (!title || (type !== "poll" && type !== "ranking")) {
      return new Response(JSON.stringify({ error: "title and type ('poll'|'ranking') are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (title.length > 200) {
      return new Response(JSON.stringify({ error: "title too long (max 200 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existingItems.length > 50) {
      return new Response(JSON.stringify({ error: "too many existing items (max 50)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Per-club AI master switch ──
    const gate = await aiGate(userClient);
    if (!gate.enabled) {
      return new Response(JSON.stringify({ error: "AI features are turned off for this club." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Per-user AI rate limit (lightweight cost cap) ──
    const { data: quota } = await userClient.rpc("consume_ai_quota", {
      _function_name: "suggest-items", _max_requests: 20, _window_minutes: 60,
    });
    if (quota && quota.allowed === false) {
      return new Response(JSON.stringify({
        error: "Rate limit reached", retry_after: quota.retry_after, remaining: 0,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeExisting = existingItems
      .filter((x: unknown): x is string => typeof x === "string")
      .map((x: string) => x.slice(0, 80));

    const typeLabel = type === "poll" ? "poll options/answers" : "items to rank";
    const systemPrompt = `You suggest items for a fun private friend group competition app called DH. Given a ${type} titled "${title}", suggest 5-8 short, distinct ${typeLabel}. ${safeExisting.length ? `Exclude these already-added items: ${safeExisting.join(", ")}.` : ""} Keep suggestions fun, relevant, and concise (1-5 words each). Don't number them.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Suggest ${typeLabel} for: "${title}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_suggestions",
              description: "Return a list of suggestion strings",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of 5-8 short suggestion strings",
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_suggestions" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    await logAiUsage(
      { functionName: "suggest-items", model: "google/gemini-2.5-flash", userId: user.id, clubId: gate.clubId },
      data.usage,
    );
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ suggestions: parsed.suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-items error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
