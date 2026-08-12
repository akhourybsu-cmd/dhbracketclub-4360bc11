import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { mondayWeekBounds } from '@/lib/workout/week';
import {
  scoreEntry, sessionPoints,
  type LogEntry, type LogSession, type LogSessionWithEntries, type LogKind, type LogSet,
} from '@/lib/workout/logScoring';

// Untyped table access — workout_log_* tables aren't in the generated types.
const sb = supabase as any;

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Raw values for a new entry — points are derived here, never trusted from a caller. */
export interface AddEntryInput {
  catalogId?: string | null;
  exerciseName: string;
  category?: string | null;
  logKind: LogKind;
  sets?: LogSet[];
  reps?: number | null;
  seconds?: number | null;
  distanceMi?: number | null;
  unit?: string | null;
}

/**
 * Read/write model for the FORGE freeform workout log. Surfaces the current
 * user's in-progress session (resumable across reloads — it lives in the DB),
 * their recent completed sessions, and the club-wide "fuel" totals that stoke
 * the flame. Point totals are derived from raw values via logScoring, cached
 * on each entry at save time.
 */
export function useWorkoutLog(clubId: string | undefined, userId: string | undefined) {
  const [activeSession, setActiveSession] = useState<LogSessionWithEntries | null>(null);
  const [history, setHistory] = useState<LogSessionWithEntries[]>([]);
  const [myWeekPoints, setMyWeekPoints] = useState(0);
  const [myLifetimePoints, setMyLifetimePoints] = useState(0);
  const [clubWeekPoints, setClubWeekPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekBounds = useMemo(() => {
    const { start, end } = mondayWeekBounds();
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, []);

  const refresh = useCallback(async () => {
    if (!clubId || !userId) { setLoading(false); return; }
    try {
      const [{ data: mySessions }, { data: clubWeekSessions }] = await withTimeout(
        Promise.all([
          // Every session I own (in-progress first, then recent completed).
          withTimeout(
            sb.from('workout_log_sessions')
              .select('*, entries:workout_log_entries(*)')
              .eq('club_id', clubId).eq('user_id', userId)
              .order('started_at', { ascending: false })
              .limit(40),
            HYDRATE_TIMEOUT_MS, 'workout log my sessions',
          ),
          // Club-wide completed sessions this week — for the flame fuel meter.
          withTimeout(
            sb.from('workout_log_sessions')
              .select('id, entries:workout_log_entries(points)')
              .eq('club_id', clubId).eq('status', 'completed')
              .gte('completed_at', weekBounds.startIso).lt('completed_at', weekBounds.endIso)
              .limit(500),
            HYDRATE_TIMEOUT_MS, 'workout log club week',
          ),
        ]),
        HYDRATE_TIMEOUT_MS, 'workout log hydrate',
      );

      const sortEntries = (s: any): LogSessionWithEntries => ({
        ...s,
        entries: ((s.entries || []) as LogEntry[]).slice().sort((a, b) => a.sort_order - b.sort_order),
      });
      const all = ((mySessions || []) as any[]).map(sortEntries);
      const open = all.find(s => s.status === 'in_progress') ?? null;
      const done = all.filter(s => s.status === 'completed');

      setActiveSession(open);
      setHistory(done.slice(0, 12));

      // My fuel: this week (completed) + lifetime (completed).
      const inWeek = (s: LogSession) =>
        s.completed_at && s.completed_at >= weekBounds.startIso && s.completed_at < weekBounds.endIso;
      setMyWeekPoints(done.filter(inWeek).reduce((t, s) => t + sessionPoints(s.entries), 0));
      setMyLifetimePoints(done.reduce((t, s) => t + sessionPoints(s.entries), 0));

      // Club fuel this week (all members' completed sessions).
      const clubPts = ((clubWeekSessions || []) as any[])
        .reduce((t, s) => t + sessionPoints((s.entries || []) as { points: number }[]), 0);
      setClubWeekPoints(clubPts);

      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load your workout log');
    } finally {
      setLoading(false);
    }
  }, [clubId, userId, weekBounds.startIso, weekBounds.endIso]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  // Keep the club fuel meter live as members finish workouts.
  useRealtimeSubscription({
    channelName: `workout-log-${clubId ?? 'none'}`,
    configs: clubId ? [{ table: 'workout_log_sessions', event: '*', filter: `club_id=eq.${clubId}` }] : [],
    onPayload: refresh,
    enabled: !!clubId,
  });

  // ─── Mutations ────────────────────────────────────────────────────

  /** Start a new freeform session (or return the existing open one). */
  const startSession = useCallback(async (title?: string): Promise<LogSessionWithEntries | null> => {
    if (!clubId || !userId) return null;
    if (activeSession) return activeSession;
    const { data, error: e } = await sb.from('workout_log_sessions')
      .insert({ club_id: clubId, user_id: userId, title: title ?? null, status: 'in_progress', activity_local_date: localToday() })
      .select('*').single();
    if (e || !data) throw e || new Error('Could not start session');
    const session: LogSessionWithEntries = { ...(data as LogSession), entries: [] };
    setActiveSession(session);
    return session;
  }, [clubId, userId, activeSession]);

  /** Append an entry to a session (autosave). Points derived here. */
  const addEntry = useCallback(async (sessionId: string, input: AddEntryInput): Promise<LogEntry | null> => {
    if (!clubId || !userId) return null;
    const sets = input.sets ?? [];
    const { points } = scoreEntry({
      log_kind: input.logKind, sets, reps: input.reps ?? null,
      seconds: input.seconds ?? null, distance_mi: input.distanceMi ?? null,
    });
    const sortOrder = (activeSession?.entries.length ?? 0);
    const row = {
      session_id: sessionId, club_id: clubId, user_id: userId,
      catalog_id: input.catalogId ?? null, exercise_name: input.exerciseName,
      category: input.category ?? null, log_kind: input.logKind,
      sets, reps: input.reps ?? null, seconds: input.seconds ?? null,
      distance_mi: input.distanceMi ?? null, unit: input.unit ?? null,
      points, sort_order: sortOrder,
    };
    const { data, error: e } = await sb.from('workout_log_entries').insert(row).select('*').single();
    if (e || !data) throw e || new Error('Could not save that');
    const entry = data as LogEntry;
    setActiveSession(prev => prev && prev.id === sessionId ? { ...prev, entries: [...prev.entries, entry] } : prev);
    return entry;
  }, [clubId, userId, activeSession]);

  /** Edit an entry's raw values — points are re-derived. */
  const updateEntry = useCallback(async (entryId: string, patch: Partial<AddEntryInput>): Promise<void> => {
    setActiveSession(prev => {
      if (!prev) return prev;
      const entries = prev.entries.map(en => {
        if (en.id !== entryId) return en;
        const next = {
          ...en,
          sets: patch.sets ?? en.sets,
          reps: patch.reps !== undefined ? patch.reps : en.reps,
          seconds: patch.seconds !== undefined ? patch.seconds : en.seconds,
          distance_mi: patch.distanceMi !== undefined ? patch.distanceMi : en.distance_mi,
          log_kind: patch.logKind ?? en.log_kind,
        };
        next.points = scoreEntry(next).points;
        return next;
      });
      return { ...prev, entries };
    });
    const updated = activeSession?.entries.find(e => e.id === entryId);
    const merged = updated ? {
      sets: patch.sets ?? updated.sets,
      reps: patch.reps !== undefined ? patch.reps : updated.reps,
      seconds: patch.seconds !== undefined ? patch.seconds : updated.seconds,
      distance_mi: patch.distanceMi !== undefined ? patch.distanceMi : updated.distance_mi,
      log_kind: patch.logKind ?? updated.log_kind,
    } : null;
    if (!merged) return;
    const points = scoreEntry(merged).points;
    const { error: e } = await sb.from('workout_log_entries')
      .update({ sets: merged.sets, reps: merged.reps, seconds: merged.seconds, distance_mi: merged.distance_mi, points })
      .eq('id', entryId);
    if (e) { await refresh(); throw e; }
  }, [activeSession, refresh]);

  /** Remove one entry from the active session. */
  const removeEntry = useCallback(async (entryId: string): Promise<void> => {
    const before = activeSession;
    setActiveSession(prev => prev ? { ...prev, entries: prev.entries.filter(e => e.id !== entryId) } : prev);
    const { error: e } = await sb.from('workout_log_entries').delete().eq('id', entryId);
    if (e) { setActiveSession(before); throw e; }
  }, [activeSession]);

  /** Finish a session — flips it to completed, stamping the completion time.
   *  Returns the total fuel earned. */
  const completeSession = useCallback(async (sessionId: string, title?: string | null): Promise<number> => {
    const session = activeSession;
    const total = session ? sessionPoints(session.entries) : 0;
    const { error: e } = await sb.from('workout_log_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString(), title: title ?? session?.title ?? null })
      .eq('id', sessionId);
    if (e) throw e;
    setActiveSession(null);
    await refresh();
    return total;
  }, [activeSession, refresh]);

  /** Throw away an in-progress session (and its entries via cascade). */
  const discardSession = useCallback(async (sessionId: string): Promise<void> => {
    setActiveSession(null);
    const { error: e } = await sb.from('workout_log_sessions').delete().eq('id', sessionId);
    if (e) { await refresh(); throw e; }
  }, [refresh]);

  /** Delete a past (completed) session from history. */
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    const before = history;
    setHistory(prev => prev.filter(s => s.id !== sessionId));
    const { error: e } = await sb.from('workout_log_sessions').delete().eq('id', sessionId);
    if (e) { setHistory(before); throw e; }
    await refresh();
  }, [history, refresh]);

  return {
    activeSession, history,
    myWeekPoints, myLifetimePoints, clubWeekPoints,
    loading, error, refresh,
    startSession, addEntry, updateEntry, removeEntry, completeSession, discardSession, deleteSession,
  };
}
