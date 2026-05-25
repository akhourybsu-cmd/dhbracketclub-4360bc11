import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claims.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.user.id;

    const { draft_id } = await req.json();
    if (!draft_id) {
      return new Response(JSON.stringify({ error: "draft_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role for data operations
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch draft
    const { data: draft, error: draftErr } = await admin
      .from("drafts")
      .select("*, profiles:created_by(display_name)")
      .eq("id", draft_id)
      .single();

    if (draftErr || !draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (draft.status !== "complete") {
      return new Response(JSON.stringify({ error: "Draft is not complete" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch participants and picks
    const [{ data: participants }, { data: picks }] = await Promise.all([
      admin.from("draft_participants").select("*, profiles:user_id(display_name)").eq("draft_id", draft_id).order("pick_order"),
      admin.from("draft_picks").select("*").eq("draft_id", draft_id).order("pick_number"),
    ]);

    if (!participants?.length || !picks?.length) {
      return new Response(JSON.stringify({ error: "No participants or picks found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Any participant or the creator can trigger report generation
    const isParticipant = participants.some((p: any) => p.user_id === userId);
    if (draft.created_by !== userId && !isParticipant) {
      return new Response(JSON.stringify({ error: "Only draft participants can generate the report" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build prompt
    const participantMap = new Map(participants.map((p: any) => [p.user_id, p.profiles?.display_name || "Unknown"]));

    const picksByUser: Record<string, { pick_id: string; pick_text: string; round: number }[]> = {};
    for (const pick of picks) {
      if (!picksByUser[pick.user_id]) picksByUser[pick.user_id] = [];
      picksByUser[pick.user_id].push({
        pick_id: pick.id,
        pick_text: pick.pick_text,
        round: pick.round,
      });
    }

    const participantSummaries = Object.entries(picksByUser).map(([uid, userPicks]) => {
      const name = participantMap.get(uid) || "Unknown";
      const pickList = userPicks.map((p) => `  Round ${p.round}: "${p.pick_text}" (pick_id: ${p.pick_id})`).join("\n");
      return `Participant: ${name} (user_id: ${uid})\n${pickList}`;
    }).join("\n\n");

    // ── Effective judging scope: override > original > broad-default ──
    const overrideCtx = (draft.ai_context_override || "").trim();
    const originalCtx = (draft.ai_context || "").trim();
    const effectiveCtx = overrideCtx || originalCtx;
    const ctxBlock = effectiveCtx
      ? `\n\n=== JUDGING SCOPE (AUTHORITATIVE) ===\n${overrideCtx ? "[Commissioner override — takes priority over any original context]\n" : "[Provided by draft creator]\n"}${effectiveCtx}\n\nFollow this scope exactly. Do not narrow the category beyond what this scope or the title states.`
      : `\n\n=== JUDGING SCOPE ===\nNo explicit scope was provided. Interpret the category broadly. For broad categories (e.g. "Best Villains of All Time") consider all relevant media and cultural sources — film, television, video games, comics, anime, literature, mythology, sports, real history, etc. Do not assume the category is limited to movies unless the title clearly says so.`;

    const prompt = `You are an expert strategic draft analyst for DH Bracket Club. The draft topic is: "${draft.topic}"${draft.category ? ` (Category: ${draft.category})` : ""}.${ctxBlock}

This was a snake-style draft. Evaluate every pick using the following CORE EVALUATION FRAMEWORK. Adapt your reasoning to the specific category while applying the same consistent logic.

=== EVALUATION FACTORS (apply all 8 to every pick) ===

1. CATEGORY FIT — Does the pick clearly belong in this category? Weak fit hurts; clear fit supports.
2. STANDALONE STRENGTH — How strong is this pick on its own within the category? Consider recognition, impact, quality, memorability, and respect within the topic.
3. DRAFT TIMING / SLOT VALUE — Was this pick taken at the right time? A strong item taken too early is penalized. A mid-tier item taken late at good value can be praised. Consider what round/slot it was drafted in.
4. SCARCITY / REPLACEABILITY — Is this pick hard to replace later, or are many similar alternatives available? Scarce, hard-to-replace picks get a boost.
5. BOARD SYNERGY — Does this pick complement the drafter's other selections? Does it add balance, variety, identity, or cohesion? Redundant picks are downgraded.
6. UPSIDE vs SAFETY — Is this a reliable consensus pick or a risky swing? Safe picks are rewarded for reliability. Risky picks are only rewarded if there's a clear upside argument; otherwise penalized.
7. DISTINCTIVENESS — Does this pick help the drafter stand out in a smart, defensible way? Distinctiveness is a bonus, not a replacement for quality. Do not reward randomness.
8. ALTERNATIVE COST — Were there clearly stronger or more efficient options likely available at that slot? If better options were obviously available with no board-based justification, downgrade. If the pick makes strategic sense for the board, it can still be judged well.

=== GOOD PICK ===
A pick is strong if most of: clear category fit, strong standalone quality, good timing, meaningful scarcity/value, good board synergy, clear strategic purpose, easy to defend in 1-2 sentences.

=== WEAK PICK ===
A pick is weak if one or more of: questionable category fit, low standalone quality, taken too early, easily replaceable, redundant, clearly weaker than likely alternatives, risky without upside, hard to justify strategically.

=== BEST PICK (per person) ===
Do NOT simply pick the most famous item. Identify the pick that best combines: quality + timing + value at slot + board impact + strategic fit. It should feel like the smartest or most valuable selection that person made.

=== WORST PICK (per person) ===
Do NOT simply pick the least famous item. Identify the pick that most combines: weak value for slot + weak category fit + low board impact + low scarcity + poor comparison to likely alternatives. It should feel like the least efficient or least helpful choice on that person's board.

=== FEEDBACK STYLE ===
For each pick's explanation, address:
1. What the pick does well
2. Whether the timing was good, early, late, or mixed
3. How it fits the drafter's overall board
4. Any weakness, risk, or limitation

Be strategic, specific, consistent, readable, and confident but not overly harsh. Avoid vague generic praise, random unexplained criticism, over-rewarding popularity alone, over-penalizing niche picks that are strategically sound, and contradicting yourself across similar picks.

=== SCORING ===
Rate each pick on a scale of 1.0 to 10.0 using tenth-of-a-point precision (e.g. 7.3, 8.7, 6.1). Do NOT round to whole numbers or half-points — every score must reflect a specific tenth. Differentiate meaningfully between similar picks. Then rank all participants from best to worst based on their total scores.

=== SUMMARY (per person) ===
Write a 2-3 sentence summary of each participant's draft performance. Mention their best pick, worst pick, overall board identity, and strategic approach.

Here are all participants and their picks:

${participantSummaries}

Use the rate_draft_results tool to return your structured analysis.`;

    // ── Per-user AI rate limit (expensive multi-pick analysis) ──
    const { data: quota } = await userClient.rpc("consume_ai_quota", {
      _function_name: "rate-draft", _max_requests: 5, _window_minutes: 60,
    });
    if (quota && quota.allowed === false) {
      return new Response(JSON.stringify({
        error: "Rate limit reached", retry_after: quota.retry_after, remaining: 0,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call AI with tool calling
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: `Today's date is ${new Date().toISOString().split('T')[0]}. You are a fair and insightful draft competition judge. Evaluate all picks based on their current real-world status as of today — do not treat released content as unreleased. Provide honest, entertaining, and constructive ratings.` },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rate_draft_results",
              description: "Return structured draft ratings for all participants",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        user_id: { type: "string", description: "The participant's user_id" },
                        rank: { type: "integer", description: "Rank position (1 = best)" },
                        total_score: { type: "number", description: "Sum of all pick scores" },
                        summary: { type: "string", description: "2-3 sentence summary of this participant's draft performance" },
                        pick_ratings: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              pick_id: { type: "string" },
                              pick_text: { type: "string" },
                              score: { type: "number", description: "Score from 1.0 to 10.0, must use tenth precision (e.g. 7.3, not 7.0 or 7.5)" },
                              explanation: { type: "string", description: "Brief explanation for the score" },
                            },
                            required: ["pick_id", "pick_text", "score", "explanation"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["user_id", "rank", "total_score", "summary", "pick_ratings"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["results"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "rate_draft_results" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "AI returned unexpected format" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { results } = JSON.parse(toolCall.function.arguments);
    if (!Array.isArray(results) || results.length === 0) {
      return new Response(JSON.stringify({ error: "AI returned empty results" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Re-rank using multi-factor tiebreaker — don't trust AI-assigned ranks
    const numParticipants = participants.length;

    // Build a map of each user's last pick timestamp for the final tiebreaker
    const lastPickTime = new Map<string, string>();
    for (const pick of picks) {
      const prev = lastPickTime.get(pick.user_id);
      if (!prev || pick.picked_at > prev) lastPickTime.set(pick.user_id, pick.picked_at);
    }

    const tiebreakMetrics = (r: any) => {
      const scores: number[] = (r.pick_ratings || []).map((p: any) => p.score);
      if (scores.length === 0) return { max: 0, elite: 0, min: 0, avg: 0 };
      return {
        max: Math.max(...scores),
        elite: scores.filter((s: number) => s >= 8).length,
        min: Math.min(...scores),
        avg: scores.reduce((a: number, b: number) => a + b, 0) / scores.length,
      };
    };

    const sortedResults = [...results].sort((a: any, b: any) => {
      // 0. Total score (primary)
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      const mA = tiebreakMetrics(a), mB = tiebreakMetrics(b);
      // 1. Highest single-pick score
      if (mB.max !== mA.max) return mB.max - mA.max;
      // 2. Count of elite picks (≥ 8)
      if (mB.elite !== mA.elite) return mB.elite - mA.elite;
      // 3. Highest lowest-pick score (consistency)
      if (mB.min !== mA.min) return mB.min - mA.min;
      // 4. Average pick score
      if (mB.avg !== mA.avg) return mB.avg - mA.avg;
      // 5. Earlier final pick wins
      const tA = lastPickTime.get(a.user_id) || "";
      const tB = lastPickTime.get(b.user_id) || "";
      return tA < tB ? -1 : tA > tB ? 1 : 0;
    });

    // Delete existing results for regeneration
    await admin.from("draft_results").delete().eq("draft_id", draft_id);

    // Insert results with corrected ranks based on total_score
    const inserts = sortedResults.map((r: any, idx: number) => ({
      draft_id,
      user_id: r.user_id,
      rank: idx + 1,
      total_score: r.total_score,
      pick_ratings: r.pick_ratings,
      summary: r.summary,
      points_awarded: Math.max(1, numParticipants - idx),
    }));

    const { error: insertErr } = await admin.from("draft_results").insert(inserts);
    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save results" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Auto-recalculate season standings if draft belongs to a season ──
    try {
      const { data: seasonEntry } = await admin
        .from("draft_season_entries")
        .select("season_id")
        .eq("draft_id", draft_id)
        .maybeSingle();

      if (seasonEntry?.season_id) {
        const seasonId = seasonEntry.season_id;
        console.log("Recalculating season standings for season:", seasonId);

        // Get all season entries
        const { data: allEntries } = await admin
          .from("draft_season_entries")
          .select("draft_id, week_number, is_playoff")
          .eq("season_id", seasonId)
          .eq("is_playoff", false);

        if (allEntries && allEntries.length > 0) {
          const allDraftIds = allEntries.map((e: any) => e.draft_id);
          const { data: allResults } = await admin
            .from("draft_results")
            .select("draft_id, user_id, rank, total_score, points_awarded")
            .in("draft_id", allDraftIds);

          if (allResults && allResults.length > 0) {
            // Get season config
            const { data: seasonData } = await admin
              .from("draft_seasons")
              .select("best_of")
              .eq("id", seasonId)
              .single();

            const bestOf = seasonData?.best_of || 10;

            // Season points by placement
            const SEASON_POINTS: Record<number, number> = { 1: 10, 2: 7, 3: 5, 4: 3, 5: 2 };
            const getSeasonPts = (rank: number) => SEASON_POINTS[rank] || 1;

            // Group results by user
            const userResults = new Map<string, Array<{ rank: number; total_score: number }>>();
            for (const r of allResults) {
              const arr = userResults.get(r.user_id) || [];
              arr.push({ rank: r.rank, total_score: Number(r.total_score) });
              userResults.set(r.user_id, arr);
            }

            // Calculate standings
            const standingsUpdates: any[] = [];
            for (const [uid, draftsArr] of userResults) {
              const withPts = draftsArr.map(d => ({ ...d, seasonPts: getSeasonPts(d.rank) }));
              withPts.sort((a, b) => b.seasonPts - a.seasonPts);
              const counted = withPts.slice(0, bestOf);
              const seasonPoints = counted.reduce((s, d) => s + d.seasonPts, 0);
              const wins = draftsArr.filter(d => d.rank === 1).length;
              const podiums = draftsArr.filter(d => d.rank <= 3).length;
              const avgFinish = draftsArr.reduce((s, d) => s + d.rank, 0) / draftsArr.length;
              const scores = draftsArr.map(d => d.total_score);
              const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
              const bestScore = Math.max(...scores);
              const worstScore = Math.min(...scores);
              const variance = scores.reduce((s, v) => s + (v - avgScore) ** 2, 0) / scores.length;

              standingsUpdates.push({
                season_id: seasonId, user_id: uid,
                season_points: seasonPoints, drafts_played: draftsArr.length,
                wins, podiums,
                avg_finish: Math.round(avgFinish * 100) / 100,
                avg_score: Math.round(avgScore * 100) / 100,
                best_score: Math.round(bestScore * 100) / 100,
                worst_score: Math.round(worstScore * 100) / 100,
                consistency: Math.round(Math.sqrt(variance) * 100) / 100,
              });
            }

            // Multi-factor tiebreaker sort
            standingsUpdates.sort((a: any, b: any) => {
              if (b.season_points !== a.season_points) return b.season_points - a.season_points;
              if (b.wins !== a.wins) return b.wins - a.wins;
              if (b.podiums !== a.podiums) return b.podiums - a.podiums;
              if (a.avg_finish !== b.avg_finish) return a.avg_finish - b.avg_finish;
              return b.avg_score - a.avg_score;
            });
            let sRank = 1;
            for (let i = 0; i < standingsUpdates.length; i++) {
              if (i > 0 && standingsUpdates[i].season_points < standingsUpdates[i - 1].season_points) sRank = i + 1;
              standingsUpdates[i].rank = sRank;
              standingsUpdates[i].playoff_seed = i + 1;
            }

            // ── Lock playoff seeds once playoffs have started ───────────────
            // Recomputing rank/playoff_seed after the bracket exists can swap
            // closely-ranked users mid-bracket, causing the same player to land
            // in two semifinal slots. Preserve existing seeds in that case.
            const { data: seasonStatusRow } = await admin
              .from("draft_seasons").select("status").eq("id", seasonId).single();
            const seedsLocked =
              seasonStatusRow?.status === "playoffs" ||
              seasonStatusRow?.status === "complete";

            let priorSeedByUser = new Map<string, { rank: number | null; playoff_seed: number | null }>();
            if (seedsLocked) {
              const { data: priorStandings } = await admin
                .from("draft_season_standings")
                .select("user_id, rank, playoff_seed")
                .eq("season_id", seasonId);
              for (const p of priorStandings || []) {
                priorSeedByUser.set(p.user_id, { rank: p.rank, playoff_seed: p.playoff_seed });
              }
            }

            await admin.from("draft_season_standings").delete().eq("season_id", seasonId);
            for (const s of standingsUpdates) {
              if (seedsLocked) {
                const prior = priorSeedByUser.get(s.user_id);
                if (prior) {
                  s.rank = prior.rank ?? s.rank;
                  s.playoff_seed = prior.playoff_seed ?? s.playoff_seed;
                }
              }
              await admin.from("draft_season_standings").insert(s);
            }
            console.log("Season standings recalculated:", standingsUpdates.length, "entries");
          }
        }
      }
    } catch (seasonErr) {
      console.error("Season recalc error (non-fatal):", seasonErr);
    }

    return new Response(JSON.stringify({ results: inserts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rate-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
