// Cron-invoked: every 15 min. Sends T-24h and T-1h push reminders to
// users who RSVP'd "going" to an upcoming event. Dedupes via the
// notification_sent_log table so a reminder fires at most once per
// (event, variant).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VARIANTS: Array<{ key: string; minutes: number; label: string }> = [
  { key: "24h", minutes: 24 * 60, label: "tomorrow" },
  { key: "1h", minutes: 60, label: "in 1 hour" },
];

// ±7 min window aligned to the 15-min cron cadence
const WINDOW_MIN = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SHARED_SECRET");
  const provided = req.headers.get("x-cron-secret") || "";
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`;

  let totalSent = 0;
  const summary: any[] = [];

  for (const v of VARIANTS) {
    const target = new Date(Date.now() + v.minutes * 60_000);
    const lo = new Date(target.getTime() - WINDOW_MIN * 60_000).toISOString();
    const hi = new Date(target.getTime() + WINDOW_MIN * 60_000).toISOString();

    const { data: events } = await supabase
      .from("events")
      .select("id, title, starts_at")
      .gte("starts_at", lo)
      .lte("starts_at", hi);

    for (const ev of events || []) {
      // Dedupe
      const { data: already } = await supabase
        .from("notification_sent_log")
        .select("id")
        .eq("type", "event")
        .eq("entity_id", ev.id)
        .eq("variant", v.key)
        .maybeSingle();
      if (already) continue;

      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("user_id")
        .eq("event_id", ev.id)
        .eq("status", "going");
      const userIds = [...new Set((rsvps || []).map((r: any) => r.user_id))];
      if (userIds.length === 0) {
        await supabase.from("notification_sent_log").insert({
          type: "event", entity_id: ev.id, variant: v.key,
        });
        continue;
      }

      const res = await fetch(fnBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": expected,
        },
        body: JSON.stringify({
          type: "event",
          title: `Reminder: ${ev.title}`,
          message: `Starts ${v.label}.`,
          url: `/events/${ev.id}`,
          tag: `dh-event-${ev.id}-${v.key}`,
          target_user_ids: userIds,
        }),
      });
      const j = await res.json().catch(() => ({}));
      totalSent += j?.sent || 0;
      summary.push({ event: ev.id, variant: v.key, sent: j?.sent });

      await supabase.from("notification_sent_log").insert({
        type: "event", entity_id: ev.id, variant: v.key,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, totalSent, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
