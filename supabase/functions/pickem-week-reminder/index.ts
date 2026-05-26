// Cron-invoked: every 30 min. While an NFL week is open, broadcasts:
//   - "Week N open" once per week
//   - "Picks lock in 1 hour" once before the lock cutoff
// Dedupes via notification_sent_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const WINDOW_MIN = 17; // 30-min cron, half + slack

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const expected = Deno.env.get("CRON_SHARED_SECRET");
  if (!expected || (req.headers.get("x-cron-secret") || "") !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`;

  const broadcast = (title: string, message: string, url: string, tag: string) =>
    fetch(fnBase, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": expected },
      body: JSON.stringify({ type: "pickem", title, message, url, tag }),
    }).then((r) => r.json()).catch(() => ({}));

  const dedupe = async (id: string, variant: string) => {
    const { data } = await supabase.from("notification_sent_log")
      .select("id").eq("type", "pickem").eq("entity_id", id).eq("variant", variant).maybeSingle();
    return !!data;
  };
  const logSent = (id: string, variant: string) =>
    supabase.from("notification_sent_log").insert({ type: "pickem", entity_id: id, variant });

  let sent = 0;

  // 1) Week-open broadcast
  const { data: openWeeks } = await supabase
    .from("nfl_weeks")
    .select("id, week_number, status")
    .in("status", ["open", "partially_locked"]);

  for (const w of openWeeks || []) {
    if (!(await dedupe(w.id, "open"))) {
      const r = await broadcast(
        `NFL Pick'em — Week ${w.week_number}`,
        "Picks are open. Lock yours in before kickoff.",
        `/pickem/week/${w.id}`,
        `dh-pickem-${w.id}-open`,
      );
      sent += r?.sent || 0;
      await logSent(w.id, "open");
    }

    // 2) T-1h before first kickoff
    const { data: firstGame } = await supabase
      .from("nfl_games")
      .select("kickoff_at")
      .eq("week_id", w.id)
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstGame?.kickoff_at) continue;

    const kickoffMs = new Date(firstGame.kickoff_at).getTime();
    const targetMs = kickoffMs - 60 * 60_000;
    if (Math.abs(targetMs - Date.now()) <= WINDOW_MIN * 60_000) {
      if (!(await dedupe(w.id, "1h"))) {
        const r = await broadcast(
          `Week ${w.week_number} picks lock soon`,
          "Kickoff is in 1 hour. Get your picks in.",
          `/pickem/week/${w.id}`,
          `dh-pickem-${w.id}-1h`,
        );
        sent += r?.sent || 0;
        await logSent(w.id, "1h");
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
