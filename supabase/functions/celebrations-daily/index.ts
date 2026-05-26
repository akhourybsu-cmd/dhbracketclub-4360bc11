// Cron-invoked: 08:00 UTC daily. Broadcasts today's birthdays and
// milestones (work anniversaries, etc.) to the club. Dedupes per-day
// via notification_sent_log so a manual re-run does not double-send.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const today = new Date();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");
  const todayKey = `${today.getUTCFullYear()}-${mm}-${dd}`;

  // Dedupe
  const { data: already } = await supabase
    .from("notification_sent_log")
    .select("id")
    .eq("type", "celebrations")
    .eq("entity_id", todayKey)
    .eq("variant", "daily")
    .maybeSingle();
  if (already) {
    return new Response(JSON.stringify({ ok: true, skipped: "already_sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find today's celebrations. Table is `celebrations` with `date` column
  // stored as MM-DD or a date — we filter by month/day in JS to be safe.
  const { data: all } = await supabase
    .from("celebrations")
    .select("id, title, date, type, person_name");

  const todays = (all || []).filter((c: any) => {
    if (!c?.date) return false;
    const d = String(c.date);
    return d.slice(5, 10) === `${mm}-${dd}` || d === `${mm}-${dd}`;
  });

  if (todays.length === 0) {
    await supabase.from("notification_sent_log").insert({
      type: "celebrations", entity_id: todayKey, variant: "daily",
    });
    return new Response(JSON.stringify({ ok: true, count: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const headline = todays.length === 1
    ? `🎉 ${todays[0].person_name || todays[0].title}`
    : `🎉 ${todays.length} celebrations today`;
  const body = todays.map((c: any) => c.person_name || c.title).join(", ");

  const res = await fetch(fnBase, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": expected },
    body: JSON.stringify({
      type: "celebrations",
      title: headline,
      message: body,
      url: "/celebrations",
      tag: `dh-celebrations-${todayKey}`,
    }),
  });
  const j = await res.json().catch(() => ({}));

  await supabase.from("notification_sent_log").insert({
    type: "celebrations", entity_id: todayKey, variant: "daily",
  });

  return new Response(JSON.stringify({ ok: true, sent: j?.sent || 0, count: todays.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
