// Cron-invoked: hourly. Reminds pool members who haven't submitted a
// bracket entry that the lock window is approaching (T-24h and T-1h).
// Dedupes via notification_sent_log per (pool, variant).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VARIANTS: Array<{ key: string; minutes: number; label: string }> = [
  { key: "24h", minutes: 24 * 60, label: "tomorrow" },
  { key: "1h", minutes: 60, label: "in 1 hour" },
];
const WINDOW_MIN = 35; // hourly cron, half + slack

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

  let sent = 0;
  const log: any[] = [];

  // Pools table is shaped per the brackets module; we look up `entry_close_at`
  // / `lock_at` defensively (different installs use slightly different cols).
  const { data: pools } = await supabase
    .from("pools")
    .select("id, name, entry_close_at, lock_at, status");

  for (const v of VARIANTS) {
    const target = Date.now() + v.minutes * 60_000;

    for (const pool of pools || []) {
      const lockIso = (pool as any).entry_close_at || (pool as any).lock_at;
      if (!lockIso) continue;
      const lockMs = new Date(lockIso).getTime();
      if (Math.abs(lockMs - target) > WINDOW_MIN * 60_000) continue;

      // Dedupe
      const { data: already } = await supabase
        .from("notification_sent_log")
        .select("id")
        .eq("type", "brackets").eq("entity_id", pool.id).eq("variant", v.key)
        .maybeSingle();
      if (already) continue;

      // Members without a submitted entry
      const { data: members } = await supabase
        .from("pool_members").select("user_id").eq("pool_id", pool.id);
      const { data: entries } = await supabase
        .from("brackets")
        .select("user_id, status")
        .eq("pool_id", pool.id)
        .eq("status", "submitted");

      const submitted = new Set((entries || []).map((e: any) => e.user_id));
      const targets = (members || [])
        .map((m: any) => m.user_id)
        .filter((u: string) => !submitted.has(u));

      if (targets.length > 0) {
        const r = await fetch(fnBase, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cron-secret": expected },
          body: JSON.stringify({
            type: "brackets",
            title: `${pool.name} locks ${v.label}`,
            message: "Submit your bracket before the deadline.",
            url: `/pools/${pool.id}`,
            tag: `dh-brackets-${pool.id}-${v.key}`,
            target_user_ids: targets,
          }),
        });
        const j = await r.json().catch(() => ({}));
        sent += j?.sent || 0;
        log.push({ pool: pool.id, variant: v.key, sent: j?.sent });
      }

      await supabase.from("notification_sent_log").insert({
        type: "brackets", entity_id: pool.id, variant: v.key,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, log }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
