// Cron-invoked: every 15 min. Sends a T-1h "poll closing soon" push and,
// after a poll's closes_at has passed, a one-shot "results" broadcast.
// Dedupes via notification_sent_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const WINDOW_MIN = 7;

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

  const broadcast = async (title: string, message: string, url: string, tag: string) => {
    const res = await fetch(fnBase, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": expected },
      body: JSON.stringify({ type: "poll", title, message, url, tag }),
    });
    return await res.json().catch(() => ({}));
  };

  const dedupe = async (id: string, variant: string) => {
    const { data } = await supabase
      .from("notification_sent_log")
      .select("id").eq("type", "poll").eq("entity_id", id).eq("variant", variant).maybeSingle();
    return !!data;
  };
  const logSent = async (id: string, variant: string) => {
    await supabase.from("notification_sent_log").insert({
      type: "poll", entity_id: id, variant,
    });
  };

  let sent = 0;

  // T-1h reminders
  const target = new Date(Date.now() + 60 * 60_000);
  const lo = new Date(target.getTime() - WINDOW_MIN * 60_000).toISOString();
  const hi = new Date(target.getTime() + WINDOW_MIN * 60_000).toISOString();
  const { data: closingSoon } = await supabase
    .from("polls")
    .select("id, question, status")
    .in("status", ["active", "open"])
    .gte("closes_at", lo).lte("closes_at", hi);
  for (const p of closingSoon || []) {
    if (await dedupe(p.id, "1h")) continue;
    const r = await broadcast(
      "Poll closing soon",
      `"${p.question}" closes in 1 hour. Cast your vote.`,
      `/polls/${p.id}`,
      `dh-poll-${p.id}-1h`,
    );
    sent += r?.sent || 0;
    await logSent(p.id, "1h");
  }

  // Results broadcast (within last 30 min after close)
  const closedSince = new Date(Date.now() - 30 * 60_000).toISOString();
  const nowIso = new Date().toISOString();
  const { data: justClosed } = await supabase
    .from("polls")
    .select("id, question")
    .lte("closes_at", nowIso).gte("closes_at", closedSince);
  for (const p of justClosed || []) {
    if (await dedupe(p.id, "results")) continue;
    const r = await broadcast(
      "Poll results in",
      `Results posted for "${p.question}".`,
      `/polls/${p.id}`,
      `dh-poll-${p.id}-results`,
    );
    sent += r?.sent || 0;
    await logSent(p.id, "results");
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
