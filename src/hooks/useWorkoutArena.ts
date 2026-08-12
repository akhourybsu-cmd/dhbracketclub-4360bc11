import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import type {
  WorkoutWeek, WorkoutExercise, WorkoutActivity, WeekExerciseWithDef,
  LogActivityInput, GroupGoalWithDef,
} from '@/lib/workout/types';
import { mondayWeekBounds } from '@/lib/workout/week';
import { pickWeeklySet, weekIndexOf, weekTitleFor, toExercisePayload } from '@/lib/workout/library';

// Untyped table access — workout_* tables aren't in the generated types yet.
const sb = supabase as any;

export interface WorkoutMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

/** Local calendar date (YYYY-MM-DD) for tz-correct streaks. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Read-model for the Workout Arena: the club's active competition week,
 * its exercises, all activity in that week (for the leaderboard), the
 * current user's lifetime activity (records/XP/milestones), and club
 * members. Everything downstream is derived from these via the scoring
 * lib — nothing here trusts a client-computed total.
 */
export function useWorkoutArena(clubId: string | undefined, userId: string | undefined) {
  const [week, setWeek] = useState<WorkoutWeek | null>(null);
  const [weekExercises, setWeekExercises] = useState<WeekExerciseWithDef[]>([]);
  const [weekActivities, setWeekActivities] = useState<WorkoutActivity[]>([]);
  const [myActivities, setMyActivities] = useState<WorkoutActivity[]>([]);
  const [members, setMembers] = useState<WorkoutMember[]>([]);
  const [unlocks, setUnlocks] = useState<string[]>([]);
  const [pastWeeks, setPastWeeks] = useState<WorkoutWeek[]>([]);
  const [groupGoals, setGroupGoals] = useState<GroupGoalWithDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only attempt auto-creation once per (club) per mount, so a failed RPC
  // (e.g. migration not deployed yet) can't spin.
  const ensureAttemptedRef = useRef<string | null>(null);
  // Every realtime event fires a refresh; responses can land out of order and
  // an older snapshot would visibly roll totals backwards. Only the newest
  // in-flight refresh is allowed to write state.
  const refreshSeqRef = useRef(0);
  // Rows this client just wrote — merged back in if a snapshot predates them.
  const recentWritesRef = useRef<WorkoutActivity[]>([]);
  const mergeRecent = (rows: WorkoutActivity[]): WorkoutActivity[] => {
    const cutoff = Date.now() - 20_000;
    recentWritesRef.current = recentWritesRef.current.filter(a => Date.parse(a.logged_at) > cutoff);
    const ids = new Set(rows.map(r => r.id));
    const missing = recentWritesRef.current.filter(a => !ids.has(a.id));
    return missing.length ? [...rows, ...missing] : rows;
  };

  const exercisesById = useMemo(() => {
    const m = new Map<string, WorkoutExercise>();
    for (const we of weekExercises) m.set(we.exercise.id, we.exercise);
    return m;
  }, [weekExercises]);

  const refresh = useCallback(async () => {
    if (!clubId || !userId) { setLoading(false); return; }
    const seq = ++refreshSeqRef.current;
    try {
      // Active week: prefer an explicitly-active row; fall back to one whose
      // window contains now (belt-and-suspenders if status wasn't flipped).
      const nowIso = new Date().toISOString();
      const { data: weeks } = await withTimeout(
        sb.from('workout_weeks').select('*')
          .eq('club_id', clubId)
          .in('status', ['active'])
          .order('starts_at', { ascending: false })
          .limit(1),
        QUERY_TIMEOUT_MS, 'workout active week',
      );
      let activeWeek: WorkoutWeek | null = (weeks && weeks[0]) || null;
      if (!activeWeek) {
        const { data: byWindow } = await withTimeout(
          sb.from('workout_weeks').select('*')
            .eq('club_id', clubId)
            .lte('starts_at', nowIso).gte('ends_at', nowIso)
            .order('starts_at', { ascending: false }).limit(1),
          QUERY_TIMEOUT_MS, 'workout week by window',
        );
        activeWeek = (byWindow && byWindow[0]) || null;
      }

      // No active week — or the current one has ended — → the system drops
      // this week's gauntlet automatically (first-open fallback to the cron).
      // Idempotent + race-safe via the RPC; keyed per (club, Monday) so a new
      // week rolls the next Monday even within a long-lived session.
      const { start, end } = mondayWeekBounds();
      const rollKey = `${clubId}:${start.toISOString()}`;
      const needsRoll = !activeWeek || new Date(activeWeek.ends_at).getTime() <= Date.now();
      if (needsRoll && ensureAttemptedRef.current !== rollKey) {
        ensureAttemptedRef.current = rollKey;
        const idx = weekIndexOf(start);
        const exercises = pickWeeklySet(idx).map((e, i) => ({ ...toExercisePayload(e), goal: e.baseline, sort_order: i }));
        try {
          await withTimeout(
            sb.rpc('ensure_forge_week', {
              p_club_id: clubId,
              p_starts_at: start.toISOString(),
              p_ends_at: end.toISOString(),
              p_title: weekTitleFor(idx),
              p_theme: 'Weekly Gauntlet',
              p_exercises: exercises,
            }),
            HYDRATE_TIMEOUT_MS, 'ensure forge week',
          );
          const { data: fresh } = await withTimeout(
            sb.from('workout_weeks').select('*').eq('club_id', clubId).in('status', ['active']).order('starts_at', { ascending: false }).limit(1),
            QUERY_TIMEOUT_MS, 'forge week refetch',
          );
          activeWeek = (fresh && fresh[0]) || null;
        } catch { /* migration may not be deployed yet — fall back to cold state */ }
      }

      setWeek(activeWeek);

      const [{ data: memberRows }, weekBundle, { data: mine }, { data: unlockRows }, { data: pastRows }] = await withTimeout(
        Promise.all([
          withTimeout(
            sb.from('club_members').select('user_id').eq('club_id', clubId),
            QUERY_TIMEOUT_MS, 'workout members',
          ),
          activeWeek
            ? withTimeout(Promise.all([
                sb.from('workout_week_exercises').select('*, exercise:workout_exercises(*)').eq('week_id', activeWeek.id).order('sort_order'),
                sb.from('workout_activities').select('*').eq('week_id', activeWeek.id).eq('status', 'active'),
                sb.from('workout_group_goals').select('*, exercise:workout_exercises(*)').eq('week_id', activeWeek.id),
              ]), HYDRATE_TIMEOUT_MS, 'workout week bundle')
            : Promise.resolve([{ data: [] }, { data: [] }, { data: [] }] as any),
          withTimeout(
            sb.from('workout_activities').select('*').eq('user_id', userId).eq('status', 'active').order('logged_at', { ascending: false }).limit(1000),
            QUERY_TIMEOUT_MS, 'workout my activity',
          ),
          withTimeout(
            sb.from('workout_achievement_unlocks').select('achievement_key').eq('club_id', clubId).eq('user_id', userId),
            QUERY_TIMEOUT_MS, 'workout unlocks',
          ),
          withTimeout(
            sb.from('workout_weeks').select('*').eq('club_id', clubId).eq('status', 'completed').order('ends_at', { ascending: false }).limit(6),
            QUERY_TIMEOUT_MS, 'workout past weeks',
          ),
        ]),
        HYDRATE_TIMEOUT_MS, 'workout arena hydrate',
      );

      if (seq !== refreshSeqRef.current) return; // a newer refresh already won
      const [{ data: weRows }, { data: actRows }, { data: ggRows }] = weekBundle as any;
      setWeekExercises((weRows || []).filter((r: any) => r.exercise) as WeekExerciseWithDef[]);
      setWeekActivities(mergeRecent((actRows || []) as WorkoutActivity[]));
      setGroupGoals(((ggRows || []) as GroupGoalWithDef[]).filter(g => g.exercise));
      setMyActivities(mergeRecent((mine || []) as WorkoutActivity[]));
      setUnlocks(((unlockRows || []) as any[]).map(r => r.achievement_key));
      setPastWeeks((pastRows || []) as WorkoutWeek[]);
      // Profiles are fetched separately — there's no FK embed from
      // club_members.user_id to profiles, so the join alias silently yields null.
      const memberIds = ((memberRows || []) as any[]).map(r => r.user_id).filter(Boolean);
      if (memberIds.length) {
        const { data: profRows } = await withTimeout(
          sb.from('profiles').select('id, display_name, avatar_url').in('id', memberIds),
          QUERY_TIMEOUT_MS, 'workout member profiles',
        );
        setMembers(
          ((profRows || []) as any[])
            .filter(p => p && p.id)
            .map(p => ({ id: p.id, display_name: p.display_name || 'Member', avatar_url: p.avatar_url ?? null })),
        );
      } else {
        setMembers([]);
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Workout Arena');
    } finally {
      setLoading(false);
    }
  }, [clubId, userId]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  // Live leaderboard/progress: any activity change in this club re-pulls.
  // Debounced so a burst of quick logs collapses into one snapshot read.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => { refresh(); }, 400);
  }, [refresh]);
  useEffect(() => () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); }, []);

  useRealtimeSubscription({
    channelName: `workout-arena-${clubId ?? 'none'}`,
    configs: clubId ? [{ table: 'workout_activities', event: '*', filter: `club_id=eq.${clubId}` }] : [],
    onPayload: scheduleRefresh,
    enabled: !!clubId,
  });

  /** Forget a locally-tracked write so a snapshot can't resurrect it. */
  const forgetRecent = (ids: Set<string>) => {
    recentWritesRef.current = recentWritesRef.current.filter(a => !ids.has(a.id));
  };

  // ─── Mutations (optimistic; reconcile on refresh) ─────────────────
  const logActivity = useCallback(async (input: LogActivityInput) => {
    if (!clubId || !userId) return;
    const optimistic: WorkoutActivity = {
      id: `opt-${Date.now()}`,
      club_id: clubId,
      user_id: userId,
      week_id: input.weekId,
      exercise_id: input.exercise.id,
      measurement_type: input.exercise.measurement_type,
      raw_value: input.rawValue,
      unit: input.exercise.unit,
      started_at: input.startedAt ?? null,
      ended_at: input.endedAt ?? null,
      logged_at: new Date().toISOString(),
      activity_local_date: localToday(),
      source_type: input.source ?? 'manual',
      source_activity_id: input.sourceActivityId ?? null,
      metadata: input.metadata ?? {},
      competition_points: null,
      xp_awarded: null,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    const beforeWeek = weekActivities;
    const beforeMine = myActivities;
    if (input.weekId) setWeekActivities(prev => [...prev, optimistic]);
    setMyActivities(prev => [optimistic, ...prev]);

    const row = {
      club_id: clubId,
      user_id: userId,
      week_id: input.weekId,
      exercise_id: input.exercise.id,
      measurement_type: input.exercise.measurement_type,
      raw_value: input.rawValue,
      unit: input.exercise.unit,
      started_at: input.startedAt ?? null,
      ended_at: input.endedAt ?? null,
      activity_local_date: optimistic.activity_local_date,
      source_type: optimistic.source_type,
      source_activity_id: optimistic.source_activity_id,
      metadata: optimistic.metadata,
    };
    const { data, error: insErr } = await sb.from('workout_activities').insert(row).select('*').single();
    if (insErr || !data) {
      setWeekActivities(beforeWeek);
      setMyActivities(beforeMine);
      throw insErr || new Error('log failed');
    }
    // Reconcile the optimistic row with the authoritative one, and remember it
    // briefly so an in-flight (older) snapshot can't drop it from the totals.
    recentWritesRef.current = [...recentWritesRef.current, data as WorkoutActivity];
    if (input.weekId) setWeekActivities(prev => prev.map(a => a.id === optimistic.id ? (data as WorkoutActivity) : a));
    setMyActivities(prev => prev.map(a => a.id === optimistic.id ? (data as WorkoutActivity) : a));
    return data as WorkoutActivity;
  }, [clubId, userId, weekActivities, myActivities]);

  /** Undo the most recent activity the current user logged for an exercise
   *  in the active week (the "undo last" affordance on rep loggers). */
  const undoLast = useCallback(async (exerciseId: string) => {
    const mineForEx = weekActivities
      .filter(a => a.user_id === userId && a.exercise_id === exerciseId && a.status === 'active' && !a.id.startsWith('opt-'))
      .sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1));
    const last = mineForEx[0];
    if (!last) return;
    const beforeWeek = weekActivities;
    const beforeMine = myActivities;
    forgetRecent(new Set([last.id]));
    setWeekActivities(prev => prev.filter(a => a.id !== last.id));
    setMyActivities(prev => prev.filter(a => a.id !== last.id));
    const { error: delErr } = await sb.from('workout_activities').delete().eq('id', last.id);
    if (delErr) {
      setWeekActivities(beforeWeek);
      setMyActivities(beforeMine);
      throw delErr;
    }
  }, [weekActivities, myActivities, userId]);

  /** Delete a single logged activity (own row, or any row for club admins —
   *  RLS enforces which is allowed). */
  const deleteActivity = useCallback(async (activityId: string) => {
    if (activityId.startsWith('opt-')) return;
    const beforeWeek = weekActivities;
    const beforeMine = myActivities;
    forgetRecent(new Set([activityId]));
    setWeekActivities(prev => prev.filter(a => a.id !== activityId));
    setMyActivities(prev => prev.filter(a => a.id !== activityId));
    const { error: e } = await sb.from('workout_activities').delete().eq('id', activityId);
    if (e) {
      setWeekActivities(beforeWeek);
      setMyActivities(beforeMine);
      throw e;
    }
  }, [weekActivities, myActivities]);

  /** Wipe a member's entire log for a week — optionally scoped to one
   *  exercise. Members may only reset themselves; admins may reset anyone
   *  (enforced by RLS, not the client). */
  const resetWeek = useCallback(async (
    weekId: string,
    targetUserId: string,
    exerciseId?: string,
  ) => {
    const beforeWeek = weekActivities;
    const beforeMine = myActivities;
    const match = (a: WorkoutActivity) =>
      a.week_id === weekId && a.user_id === targetUserId && (!exerciseId || a.exercise_id === exerciseId);
    setWeekActivities(prev => prev.filter(a => !match(a)));
    setMyActivities(prev => prev.filter(a => !match(a)));
    let q = sb.from('workout_activities').delete().eq('week_id', weekId).eq('user_id', targetUserId);
    if (exerciseId) q = q.eq('exercise_id', exerciseId);
    const { error: e } = await q;
    if (e) {
      setWeekActivities(beforeWeek);
      setMyActivities(beforeMine);
      throw e;
    }
    await refresh();
  }, [weekActivities, myActivities, refresh]);

  /** Persist an achievement unlock (idempotent via the unique index).
   *  Returns true if this was a genuinely new unlock for the user. */
  const insertUnlock = useCallback(async (key: string): Promise<boolean> => {
    if (!clubId || !userId) return false;
    if (unlocks.includes(key)) return false;
    setUnlocks(prev => prev.includes(key) ? prev : [...prev, key]);
    const { error: e } = await sb.from('workout_achievement_unlocks')
      .insert({ club_id: clubId, user_id: userId, achievement_key: key });
    // A duplicate (already unlocked elsewhere) is fine — treat as not-new.
    if (e && !String(e.message || '').toLowerCase().includes('duplicate')) {
      setUnlocks(prev => prev.filter(k => k !== key));
      return false;
    }
    return !e;
  }, [clubId, userId, unlocks]);


  return {
    week, weekExercises, weekActivities, myActivities, members, exercisesById,
    unlocks, pastWeeks, groupGoals,
    loading, error, refresh, logActivity, undoLast, insertUnlock,
    deleteActivity, resetWeek,

    localToday,
  };
}
