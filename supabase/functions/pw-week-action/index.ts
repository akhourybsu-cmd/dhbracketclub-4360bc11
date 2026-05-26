// Portfolio Wars admin/cron orchestration:
//  - action: "open_next"  -> create next upcoming weekly challenge if missing
//  - action: "snapshot"   -> capture latest prices for all tickers in current/active week
//  - action: "lock"       -> lock active week (status=locked->active), capture START prices
//  - action: "finalize"   -> mark completed, capture END prices, compute pct, ranks, accolades
//
// Auth: requires authenticated admin (is_app_admin or is_platform_owner).
// pg_cron can call with service-role bearer instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const FINNHUB = "https://finnhub.io/api/v1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY")!;

interface FinnhubQuote { c: number; o: number; pc: number; h: number; l: number; t: number; }

async function quote(symbol: string): Promise<FinnhubQuote | null> {
  try {
    const r = await fetch(`${FINNHUB}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || typeof d.c !== "number" || d.c === 0) return null;
    return d;
  } catch { return null; }
}

// US Eastern week math (server is UTC).
// We treat Mon = day 1 of trading week. We compute lock_at/end_at in UTC equivalents
// of 9:30 AM ET / 4:00 PM ET. Eastern offset: EST=UTC-5, EDT=UTC-4. We approximate with
// fixed UTC times using DST-aware Intl conversion.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function mondayOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0 sun .. 6 sat
  const diff = (dow + 6) % 7; // 0 if mon
  x.setUTCDate(x.getUTCDate() - diff);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x;
}
// Convert a wall-clock ET time on a given UTC date into a real UTC timestamp.
function etToUtc(date: Date, hour: number, minute: number): Date {
  // Use Intl to figure out the offset for the date (handles DST).
  const dt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute));
  // Get the offset in minutes of America/New_York at that moment.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", timeZoneName: "shortOffset",
  });
  const parts = fmt.formatToParts(dt).find((p) => p.type === "timeZoneName")?.value || "GMT-5";
  const m = /GMT([+-]\d+)/.exec(parts);
  const offsetHrs = m ? parseInt(m[1], 10) : -5;
  // dt currently represents the wall time interpreted as UTC; subtract offset to get true UTC.
  return new Date(dt.getTime() - offsetHrs * 60 * 60 * 1000);
}
function isoWeekNumber(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return { year: t.getUTCFullYear(), week };
}

const CRON_SHARED_SECRET = Deno.env.get("CRON_SHARED_SECRET") || "";

async function authedAdmin(req: Request) {
  // Allow pg_cron / internal schedulers via shared secret header (constant-time-ish compare)
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (CRON_SHARED_SECRET && cronHeader && cronHeader === CRON_SHARED_SECRET) {
    return { ok: true, service: true, userId: null };
  }
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "Missing bearer" };
  // Allow service-role to bypass (cron)
  if (token === SUPABASE_SERVICE_ROLE_KEY) return { ok: true, service: true, userId: null };
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Invalid session" };
  const { data: isAdmin } = await sb.rpc("is_app_admin", { _user_id: user.id });
  const { data: isOwner } = await sb.rpc("is_platform_owner", { _user: user.id });
  if (!isAdmin && !isOwner) return { ok: false, status: 403, error: "Admin only" };
  return { ok: true, service: false, userId: user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await authedAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = (body.action || "snapshot") as string;

  try {
    switch (action) {
      case "open_next":      return await openNext(sb);
      case "snapshot":       return await snapshotPrices(sb);
      case "lock":           return await lockWeek(sb, body.challenge_id);
      case "finalize":       return await finalizeWeek(sb, body.challenge_id);
      case "lock_reminder":  return await lockReminder(sb);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("pw-week-action error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function openNext(sb: ReturnType<typeof createClient>) {
  // For each active club, ensure the next upcoming weekly challenge exists.
  const now = new Date();
  const { data: clubs } = await sb.from("clubs").select("id, name").eq("status", "active");
  const created: any[] = [];
  for (const club of clubs || []) {
    let target = mondayOfWeek(now);
    for (let attempt = 0; attempt < 8; attempt++) {
      const lockCandidate = etToUtc(target, 9, 30);
      if (lockCandidate.getTime() <= now.getTime()) {
        target = addDays(target, 7);
        continue;
      }
      const { year, week } = isoWeekNumber(target);
      const { data: existing } = await sb.from("pw_challenges")
        .select("id").eq("club_id", club.id).eq("year", year).eq("week_number", week).maybeSingle();
      if (!existing) break;
      target = addDays(target, 7);
    }
    const { year, week } = isoWeekNumber(target);
    const friday = addDays(target, 4);
    const lock_at = etToUtc(target, 9, 30);
    const end_at = etToUtc(friday, 16, 0);
    const { data, error } = await sb.from("pw_challenges").insert({
      club_id: club.id,
      year, week_number: week,
      week_start: isoDate(target), week_end: isoDate(friday),
      lock_at: lock_at.toISOString(), end_at: end_at.toISOString(),
      status: "upcoming",
    }).select("*").single();
    if (error) {
      console.error(`pw open_next failed for club ${club.id}:`, error);
      continue;
    }
    created.push(data);
  }
  return new Response(JSON.stringify({ ok: true, created }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function uniqueTickersForChallenge(sb: any, challengeId: string): Promise<string[]> {
  const { data: entries } = await sb.from("pw_entries").select("id").eq("challenge_id", challengeId);
  if (!entries?.length) return [];
  const ids = entries.map((e: any) => e.id);
  const { data: picks } = await sb.from("pw_picks").select("ticker").in("entry_id", ids);
  return [...new Set((picks || []).map((p: any) => p.ticker))];
}

async function snapshotPrices(sb: any) {
  // Snapshot latest prices for the active OR locked current challenge in EVERY club.
  const { data: challenges } = await sb.from("pw_challenges")
    .select("*").in("status", ["active", "locked"]).order("week_start", { ascending: false });
  if (!challenges?.length) {
    return new Response(JSON.stringify({ ok: true, skipped: "no active week" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // De-dup: take the most recent active challenge per club
  const perClub = new Map<string, any>();
  for (const c of challenges) {
    if (!perClub.has(c.club_id)) perClub.set(c.club_id, c);
  }
  const results: any[] = [];
  for (const ch of perClub.values()) {
    const tickers = await uniqueTickersForChallenge(sb, ch.id);
    if (!tickers.length) { results.push({ club_id: ch.club_id, skipped: "no picks" }); continue; }
    const today = isoDate(new Date());
    let updated = 0;
    for (const sym of tickers) {
      const q = await quote(sym);
      if (!q) continue;
      await sb.from("pw_price_snapshots").upsert({
        challenge_id: ch.id, ticker: sym, kind: "latest",
        price: q.c, trading_date: today, captured_at: new Date().toISOString(),
      }, { onConflict: "challenge_id,ticker,kind" });
      const { data: startSnap } = await sb.from("pw_price_snapshots")
        .select("price").eq("challenge_id", ch.id).eq("ticker", sym).eq("kind", "start").maybeSingle();
      const start = startSnap?.price ? Number(startSnap.price) : null;
      const latest = q.c;
      const pct = start ? ((latest - start) / start) * 100 : null;
      const { data: entries } = await sb.from("pw_entries").select("id").eq("challenge_id", ch.id);
      const ids = (entries || []).map((e: any) => e.id);
      if (ids.length) {
        await sb.from("pw_picks").update({
          latest_price: latest, ...(pct !== null ? { pct_change: pct } : {}),
        }).in("entry_id", ids).eq("ticker", sym);
      }
      updated++;
    }
    await recomputeEntryAverages(sb, ch.id);
    results.push({ club_id: ch.club_id, challenge_id: ch.id, updated });
  }
  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function lockOneChallenge(sb: any, ch: any) {
  const tickers = await uniqueTickersForChallenge(sb, ch.id);
  const today = isoDate(new Date());
  for (const sym of tickers) {
    const q = await quote(sym);
    if (!q) continue;
    const startPrice = q.o || q.c;
    await sb.from("pw_price_snapshots").upsert({
      challenge_id: ch.id, ticker: sym, kind: "start",
      price: startPrice, trading_date: today,
    }, { onConflict: "challenge_id,ticker,kind" });
    const { data: entries } = await sb.from("pw_entries").select("id").eq("challenge_id", ch.id);
    const ids = (entries || []).map((e: any) => e.id);
    if (ids.length) {
      await sb.from("pw_picks").update({ start_price: startPrice }).in("entry_id", ids).eq("ticker", sym);
    }
  }
  await sb.from("pw_challenges").update({
    status: "active", start_trading_date: today,
  }).eq("id", ch.id);
  await sb.from("pw_entries").update({ locked_at: new Date().toISOString() }).eq("challenge_id", ch.id);
  await broadcastPush({
    title: "🔒 Portfolio Wars locked in",
    message: "This week's picks are locked. May the best portfolio win.",
    url: "/portfolio-wars",
    tag: `pw-lock-${ch.id}`,
    club_id: ch.club_id,
  });
  return { challenge_id: ch.id, club_id: ch.club_id, locked_tickers: tickers.length };
}

async function lockWeek(sb: any, challengeId?: string) {
  if (challengeId) {
    const { data: ch } = await sb.from("pw_challenges").select("*").eq("id", challengeId).maybeSingle();
    if (!ch) throw new Error("Challenge not found");
    const result = await lockOneChallenge(sb, ch);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // No specific challenge: lock the next upcoming for EVERY club whose lock_at <= now
  const { data: list } = await sb.from("pw_challenges").select("*")
    .eq("status", "upcoming").lte("lock_at", new Date().toISOString())
    .order("week_start", { ascending: true });
  // Take earliest per club
  const perClub = new Map<string, any>();
  for (const c of list || []) if (!perClub.has(c.club_id)) perClub.set(c.club_id, c);
  const results: any[] = [];
  for (const ch of perClub.values()) {
    try { results.push(await lockOneChallenge(sb, ch)); }
    catch (e) { console.error("lock failed for", ch.id, e); }
  }
  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function finalizeOneChallenge(sb: any, ch: any) {
  const tickers = await uniqueTickersForChallenge(sb, ch.id);
  const today = isoDate(new Date());
  for (const sym of tickers) {
    const q = await quote(sym);
    if (!q) continue;
    const endPrice = q.c;
    await sb.from("pw_price_snapshots").upsert({
      challenge_id: ch.id, ticker: sym, kind: "end",
      price: endPrice, trading_date: today,
    }, { onConflict: "challenge_id,ticker,kind" });
    const { data: entries } = await sb.from("pw_entries").select("id").eq("challenge_id", ch.id);
    const ids = (entries || []).map((e: any) => e.id);
    if (ids.length) {
      const { data: picks } = await sb.from("pw_picks")
        .select("id, start_price").in("entry_id", ids).eq("ticker", sym);
      for (const p of picks || []) {
        const start = p.start_price ? Number(p.start_price) : null;
        const pct = start ? ((endPrice - start) / start) * 100 : null;
        await sb.from("pw_picks").update({
          end_price: endPrice, latest_price: endPrice,
          ...(pct !== null ? { pct_change: pct } : {}),
        }).eq("id", p.id);
      }
    }
  }
  await recomputeEntryAverages(sb, ch.id);
  await assignRanksAndAccolades(sb, ch.id);
  await sb.from("pw_challenges").update({
    status: "completed", end_trading_date: today, finalized_at: new Date().toISOString(),
  }).eq("id", ch.id);
  await broadcastPush({
    title: "🏆 Portfolio Wars results are in",
    message: "See who climbed the leaderboard this week.",
    url: "/portfolio-wars",
    tag: `pw-finalize-${ch.id}`,
    club_id: ch.club_id,
  });
  return { challenge_id: ch.id, club_id: ch.club_id };
}

async function finalizeWeek(sb: any, challengeId?: string) {
  if (challengeId) {
    const { data: ch } = await sb.from("pw_challenges").select("*").eq("id", challengeId).maybeSingle();
    if (!ch) throw new Error("Challenge not found");
    const result = await finalizeOneChallenge(sb, ch);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Finalize all currently-active challenges whose end_at <= now
  const { data: list } = await sb.from("pw_challenges").select("*")
    .eq("status", "active").lte("end_at", new Date().toISOString())
    .order("week_start", { ascending: false });
  const results: any[] = [];
  for (const ch of list || []) {
    try { results.push(await finalizeOneChallenge(sb, ch)); }
    catch (e) { console.error("finalize failed for", ch.id, e); }
  }
  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function lockReminder(sb: any) {
  // For every club, find the next upcoming challenge whose lock is within ~36h and notify.
  const { data: list } = await sb.from("pw_challenges").select("*")
    .eq("status", "upcoming").order("week_start", { ascending: true });
  const perClub = new Map<string, any>();
  for (const c of list || []) if (!perClub.has(c.club_id)) perClub.set(c.club_id, c);
  const results: any[] = [];
  for (const ch of perClub.values()) {
    const lockMs = new Date(ch.lock_at).getTime();
    const hoursToLock = (lockMs - Date.now()) / (1000 * 60 * 60);
    if (hoursToLock <= 0 || hoursToLock > 36) continue;
    await broadcastPush({
      title: "📈 Picks lock tomorrow",
      message: "Lock in your Portfolio Wars picks before Monday's open.",
      url: "/portfolio-wars",
      tag: `pw-reminder-${ch.id}`,
      club_id: ch.club_id,
    });
    results.push({ club_id: ch.club_id, challenge_id: ch.id, sent: true });
  }
  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function broadcastPush(args: { title: string; message: string; url: string; tag: string; club_id?: string }) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        type: "portfolio_wars",
        title: args.title,
        message: args.message,
        url: args.url,
        tag: args.tag,
        club_id: args.club_id,
      }),
    });
  } catch (e) {
    console.error("pw broadcastPush failed:", e);
  }
}

async function recomputeEntryAverages(sb: any, challengeId: string) {
  const { data: entries } = await sb.from("pw_entries").select("id").eq("challenge_id", challengeId);
  for (const e of entries || []) {
    const { data: picks } = await sb.from("pw_picks").select("pct_change").eq("entry_id", e.id);
    const valid = (picks || []).map((p: any) => p.pct_change != null ? Number(p.pct_change) : null).filter((v: any) => v != null);
    if (valid.length === 0) continue;
    const avg = valid.reduce((a: number, b: number) => a + b, 0) / valid.length;
    await sb.from("pw_entries").update({ avg_pct: avg }).eq("id", e.id);
  }
}

async function assignRanksAndAccolades(sb: any, challengeId: string) {
  // Ranks
  const { data: entries } = await sb.from("pw_entries")
    .select("id, user_id, avg_pct").eq("challenge_id", challengeId)
    .not("avg_pct", "is", null).order("avg_pct", { ascending: false });
  let rank = 1;
  for (const e of entries || []) {
    await sb.from("pw_entries").update({ final_rank: rank }).eq("id", e.id);
    rank++;
  }
  if (!entries?.length) return;
  // Clear prior accolades to be idempotent
  await sb.from("pw_accolades").delete().eq("challenge_id", challengeId);
  // Winner
  const winner = entries[0];
  await sb.from("pw_accolades").insert({
    challenge_id: challengeId, user_id: winner.user_id, kind: "winner", value: winner.avg_pct,
  });
  // Per-pick stats: best, worst, balanced, boom_or_bust, bag_holder
  const ids = entries.map((e: any) => e.id);
  const { data: picks } = await sb.from("pw_picks")
    .select("id, entry_id, ticker, pct_change").in("entry_id", ids).not("pct_change", "is", null);
  if (picks?.length) {
    const byEntry = new Map<string, string>(); // entryId -> userId
    entries.forEach((e: any) => byEntry.set(e.id, e.user_id));
    const sorted = [...picks].sort((a: any, b: any) => Number(b.pct_change) - Number(a.pct_change));
    const best = sorted[0]; const worst = sorted[sorted.length - 1];
    await sb.from("pw_accolades").insert({
      challenge_id: challengeId, user_id: byEntry.get(best.entry_id), kind: "best_pick",
      ticker: best.ticker, value: best.pct_change,
    });
    await sb.from("pw_accolades").insert({
      challenge_id: challengeId, user_id: byEntry.get(worst.entry_id), kind: "worst_pick",
      ticker: worst.ticker, value: worst.pct_change,
    });
    // Most balanced = entry with smallest stdev across its picks
    // Boom or Bust = entry with largest stdev
    // Bag holder = entry with worst avg_pct (last place by avg)
    const stats = new Map<string, { mean: number; stdev: number }>();
    for (const e of entries) {
      const ps = picks.filter((p: any) => p.entry_id === e.id).map((p: any) => Number(p.pct_change));
      if (ps.length < 2) continue;
      const mean = ps.reduce((a: number, b: number) => a + b, 0) / ps.length;
      const variance = ps.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / ps.length;
      stats.set(e.id, { mean, stdev: Math.sqrt(variance) });
    }
    if (stats.size) {
      const entriesWithStats = [...stats.entries()];
      const balanced = entriesWithStats.sort((a, b) => a[1].stdev - b[1].stdev)[0];
      const boom = entriesWithStats.sort((a, b) => b[1].stdev - a[1].stdev)[0];
      await sb.from("pw_accolades").insert({
        challenge_id: challengeId, user_id: byEntry.get(balanced[0]), kind: "most_balanced", value: balanced[1].stdev,
      });
      await sb.from("pw_accolades").insert({
        challenge_id: challengeId, user_id: byEntry.get(boom[0]), kind: "boom_or_bust", value: boom[1].stdev,
      });
    }
    const last = entries[entries.length - 1];
    if (last && last.user_id !== winner.user_id) {
      await sb.from("pw_accolades").insert({
        challenge_id: challengeId, user_id: last.user_id, kind: "bag_holder", value: last.avg_pct,
      });
    }
  }
}
