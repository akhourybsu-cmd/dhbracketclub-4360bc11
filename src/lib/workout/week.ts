import { useEffect, useState } from 'react';

// FORGE competitions run Monday → Monday. These helpers pin week bounds to
// the user's LOCAL Monday so the cadence is consistent regardless of when a
// week row was authored, and drive the live countdown that gives the app its
// "timed competition" pulse.

/**
 * UTC Monday 00:00 that starts the week containing `ref`, + the next UTC
 * Monday that ends it. The boundary is UTC (not local) so the server cron
 * and the on-open client agree on the exact `starts_at` instant — that
 * shared key is what keeps week creation idempotent across both paths.
 */
export function mondayWeekBounds(ref: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const dow = d.getUTCDay();         // 0 Sun … 6 Sat
  const backToMon = (dow + 6) % 7;   // days since Monday
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - backToMon);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

/** The upcoming (or current) Monday's bounds — used to default new weeks. */
export function nextMondayBounds(ref: Date = new Date()): { start: Date; end: Date } {
  const { start, end } = mondayWeekBounds(ref);
  return { start, end };
}

export interface Countdown {
  d: number; h: number; m: number; s: number;
  totalMs: number;
  done: boolean;
}

function diff(targetMs: number): Countdown {
  const totalMs = Math.max(0, targetMs - Date.now());
  const s = Math.floor(totalMs / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    totalMs,
    done: totalMs <= 0,
  };
}

/** Live countdown to an ISO timestamp, ticking every second. */
export function useCountdown(targetIso: string | null | undefined): Countdown {
  const target = targetIso ? new Date(targetIso).getTime() : 0;
  const [now, setNow] = useState(() => diff(target));
  useEffect(() => {
    if (!targetIso) return;
    setNow(diff(target));
    const id = setInterval(() => setNow(diff(target)), 1000);
    return () => clearInterval(id);
  }, [targetIso, target]);
  return now;
}

/** "3d 11h" / "11h 04m" / "04:12" (final hour) / "Ended". */
export function formatCountdownShort(c: Countdown): string {
  if (c.done) return 'Ended';
  if (c.d > 0) return `${c.d}d ${c.h}h`;
  if (c.h > 0) return `${c.h}h ${String(c.m).padStart(2, '0')}m`;
  return `${String(c.m).padStart(2, '0')}:${String(c.s).padStart(2, '0')}`;
}
