// FORGE freeform workout log — domain types + point model.
//
// A freeform "session" is a container you fill in pieces: start it, add
// entries (each autosaves), finish it. Every entry logs ONE movement in the
// shape its `log_kind` implies (weight×reps sets, bodyweight reps, a timed
// duration, a cardio distance/time, or a plain completion).
//
// Points are FUEL, not competition: a session's total stokes the club flame
// and adds to lifetime XP, but never touches the Monday gauntlet leaderboard.
// So — unlike the featured competition, which derives everything on read from
// raw values — a freeform entry's points are computed here and cached on the
// row at save time (same honor-system trust as any manual raw_value log). The
// raw values are always stored too, so points can be re-derived if the model
// changes.

import type { LogKind } from './exerciseCatalog';
export type { LogKind } from './exerciseCatalog';

export type LogSessionStatus = 'in_progress' | 'completed';

/** A pick from the exercise search — a catalog movement or a custom one. */
export interface ExercisePick {
  catalogId: string | null;
  name: string;
  category: string | null;
  logKind: LogKind;
}

/** One set inside a weight×reps or bodyweight-reps entry. */
export interface LogSet {
  weight?: number | null; // lb; null/0 = bodyweight
  reps?: number | null;
}

export interface LogEntry {
  id: string;
  session_id: string;
  club_id: string;
  user_id: string;
  catalog_id: string | null;   // library slug, or null for a custom movement
  exercise_name: string;
  category: string | null;
  log_kind: LogKind;
  sets: LogSet[];              // weight_reps / reps
  reps: number | null;         // reps (when logged as a single total, not sets)
  seconds: number | null;      // duration / cardio time
  distance_mi: number | null;  // distance / cardio distance
  unit: string | null;
  points: number;
  sort_order: number;
  created_at: string;
}

export interface LogSession {
  id: string;
  club_id: string;
  user_id: string;
  title: string | null;
  status: LogSessionStatus;
  started_at: string;
  completed_at: string | null;
  activity_local_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogSessionWithEntries extends LogSession {
  entries: LogEntry[];
}

// ─── Point model ────────────────────────────────────────────────────
// Tuned so a solid ~30-minute session of any modality lands in a similar
// range (roughly 120–250 "fuel"). Deliberately simple + transparent; the
// UI surfaces the breakdown so a member can see why a log scored what it did.

export const POINTS = {
  VOLUME_DIVISOR: 40,     // loaded volume (lb·reps) → points
  BODYWEIGHT_REP: 0.6,    // unloaded rep → points
  REP: 0.6,               // bodyweight-reps entry, per rep
  PER_MINUTE: 5,          // duration / cardio time, per minute
  PER_MILE: 60,           // cardio / distance, per mile
  COMPLETION: 40,         // flat "did it"
} as const;

export interface PointBreakdown {
  points: number;
  label: string;   // e.g. "3,000 lb·reps", "150 reps", "28 min", "3.1 mi"
}

/** Score a single freeform entry from its raw values. Pure + deterministic. */
export function scoreEntry(entry: Pick<LogEntry, 'log_kind' | 'sets' | 'reps' | 'seconds' | 'distance_mi'>): PointBreakdown {
  const { log_kind, sets, reps, seconds, distance_mi } = entry;
  switch (log_kind) {
    case 'weight_reps': {
      let volume = 0;
      let bwReps = 0;
      for (const s of sets ?? []) {
        const w = Number(s.weight) || 0;
        const r = Number(s.reps) || 0;
        if (w > 0) volume += w * r;
        else bwReps += r;
      }
      const points = Math.round(volume / POINTS.VOLUME_DIVISOR + bwReps * POINTS.BODYWEIGHT_REP);
      const parts: string[] = [];
      if (volume > 0) parts.push(`${volume.toLocaleString()} lb·reps`);
      if (bwReps > 0) parts.push(`${bwReps} reps`);
      return { points, label: parts.join(' · ') || 'no sets' };
    }
    case 'reps': {
      const total = totalReps(sets, reps);
      return { points: Math.round(total * POINTS.REP), label: `${total.toLocaleString()} reps` };
    }
    case 'duration': {
      const secs = Number(seconds) || 0;
      return { points: Math.round((secs / 60) * POINTS.PER_MINUTE), label: fmtDur(secs) };
    }
    case 'distance': {
      const mi = Number(distance_mi) || 0;
      return { points: Math.round(mi * POINTS.PER_MILE), label: `${round1(mi)} mi` };
    }
    case 'cardio': {
      const mi = Number(distance_mi) || 0;
      const secs = Number(seconds) || 0;
      const points = Math.round(mi * POINTS.PER_MILE + (secs / 60) * POINTS.PER_MINUTE);
      const parts: string[] = [];
      if (mi > 0) parts.push(`${round1(mi)} mi`);
      if (secs > 0) parts.push(fmtDur(secs));
      return { points, label: parts.join(' · ') || 'logged' };
    }
    case 'completion':
    default: {
      const secs = Number(seconds) || 0;
      const points = POINTS.COMPLETION + Math.round((secs / 60) * POINTS.PER_MINUTE);
      return { points, label: secs > 0 ? fmtDur(secs) : 'complete' };
    }
  }
}

/** Total reps from a set list (falling back to the single `reps` total). */
export function totalReps(sets: LogSet[] | null | undefined, reps: number | null | undefined): number {
  const fromSets = (sets ?? []).reduce((t, s) => t + (Number(s.reps) || 0), 0);
  return fromSets || Number(reps) || 0;
}

export function sessionPoints(entries: Pick<LogEntry, 'points'>[]): number {
  return entries.reduce((t, e) => t + (Number(e.points) || 0), 0);
}

// ─── Small formatters ───────────────────────────────────────────────

function round1(n: number): number { return Math.round(n * 10) / 10; }

/** Duration → "1h 05m" / "28 min" / "45s". */
export function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m} min`;
  return `${sec}s`;
}

/** The default measurement unit label for a log kind. */
export function unitForKind(kind: LogKind): string {
  switch (kind) {
    case 'weight_reps': return 'lb·reps';
    case 'reps': return 'reps';
    case 'duration': return 'min';
    case 'distance': return 'mi';
    case 'cardio': return 'mi/min';
    default: return '';
  }
}

/** A short human summary of what an entry recorded, for the session list. */
export function entrySummary(entry: Pick<LogEntry, 'log_kind' | 'sets' | 'reps' | 'seconds' | 'distance_mi'>): string {
  const { log_kind, sets } = entry;
  if (log_kind === 'weight_reps') {
    const rows = (sets ?? []).filter((s) => (Number(s.reps) || 0) > 0);
    if (!rows.length) return '—';
    // Collapse identical sets: "3 × 10 @ 135 lb".
    const parts = rows.map((s) => {
      const w = Number(s.weight) || 0;
      const r = Number(s.reps) || 0;
      return w > 0 ? `${r} @ ${w} lb` : `${r} reps`;
    });
    return parts.join(', ');
  }
  return scoreEntry(entry).label;
}
