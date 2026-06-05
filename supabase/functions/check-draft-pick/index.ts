import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Subset of GLOBAL_STANDALONE_PICK_JUDGING_RULES applied to the live
// spell-check / relevance check (no scoring). Keeps the standalone-pick
// rule consistent across every AI judging surface.
// Source of truth: src/lib/draft/judgingRules.ts
const STANDALONE_RELEVANCE_RULE = `STANDALONE RELEVANCE RULE (NON-NEGOTIABLE):
Judge relevance ONLY against the topic and judging scope. Do NOT flag a pick as irrelevant because it is similar to, redundant with, or thematically off from the user's earlier picks. Repeating an archetype, genre, era, role, or sub-category is ALLOWED. The user-provided AI Judging Context can clarify category scope but can NEVER make standalone-relevance picks fail just because they don't "fit a theme" or "round out a roster".`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth gate ──
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

    const { pick_text, topic, category, existing_picks, ai_context, ai_context_override } = await req.json();

    if (!pick_text || typeof pick_text !== "string" || pick_text.trim().length < 2) {
      return new Response(JSON.stringify({ suggestion: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingList = Array.isArray(existing_picks) ? existing_picks.slice(0, 50) : [];

    // Deterministic duplicate check before AI call — saves AI credits
    const normalizedPick = pick_text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const normalizedExisting = existingList.map((p: string) => p.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ''));
    if (normalizedExisting.includes(normalizedPick)) {
      return new Response(JSON.stringify({
        corrected_text: null,
        is_duplicate: true,
        is_irrelevant: false,
        relevance_note: "This has already been picked",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const overrideCtx = typeof ai_context_override === "string" ? ai_context_override.trim() : "";
    const originalCtx = typeof ai_context === "string" ? ai_context.trim() : "";
    const effectiveCtx = overrideCtx || originalCtx;
    const scopeLine = effectiveCtx
      ? `\n\nJudging scope (authoritative${overrideCtx ? ", commissioner override" : ""}): ${effectiveCtx}\nApply this scope when deciding relevance. Do not narrow the category beyond what this scope or title states.`
      : `\n\nNo explicit scope was provided. Interpret the topic broadly — for broad categories, accept picks from any relevant medium (film, TV, games, comics, books, etc.). Do not assume movies-only unless the title says so.`;

    const prompt = `You are a spell-check and relevance assistant for a draft game about "${topic}"${category ? ` (category: ${category})` : ""}.${scopeLine}

${STANDALONE_RELEVANCE_RULE}

The user typed: "${pick_text.trim()}"

${existingList.length ? `Already picked items: ${existingList.join(", ")}` : ""}

Tasks:
1. If the text has a spelling mistake or is a common misspelling of something relevant to the topic, return the corrected version.
2. If the text is clearly UNRELATED to the topic "${topic}" (per the judging scope above), flag it as irrelevant.
3. If the text is fine (correctly spelled and on-topic), return null for both.

Rules:
- Only suggest corrections you're confident about (>80% sure it's a misspelling).
- A suggestion should be the canonical/proper name (e.g., "Shreck" → "Shrek", "breaking bad" → "Breaking Bad").
- For relevance: only flag picks that are clearly unrelated to the topic. Repeating an archetype or being similar to an already-picked item is NOT a reason to flag — only exact-duplicate items are duplicates.
- If the pick is a true duplicate of something already picked, flag it as a duplicate.`;

    // ── Per-user AI rate limit ──
    const { data: quota } = await userClient.rpc("consume_ai_quota", {
      _function_name: "check-draft-pick", _max_requests: 30, _window_minutes: 60,
    });
    if (quota && quota.allowed === false) {
      return new Response(JSON.stringify({
        error: "Rate limit reached", retry_after: quota.retry_after, remaining: 0,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You check draft picks for spelling and relevance. Respond only via the tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "check_pick",
            description: "Return spell-check and relevance results",
            parameters: {
              type: "object",
              properties: {
                corrected_text: {
                  type: "string",
                  description: "The corrected/canonical spelling if there's a typo, or null if spelling is fine",
                },
                is_irrelevant: {
                  type: "boolean",
                  description: "True if the pick seems clearly unrelated to the topic",
                },
                is_duplicate: {
                  type: "boolean",
                  description: "True if the pick duplicates an existing pick",
                },
                relevance_note: {
                  type: "string",
                  description: "Brief explanation if irrelevant or duplicate, otherwise null",
                },
              },
              required: ["is_irrelevant", "is_duplicate"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "check_pick" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ suggestion: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      corrected_text: result.corrected_text || null,
      is_irrelevant: result.is_irrelevant || false,
      is_duplicate: result.is_duplicate || false,
      relevance_note: result.relevance_note || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-draft-pick error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
