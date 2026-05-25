import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';

export type PwStatus = 'upcoming' | 'locked' | 'active' | 'completed' | 'archived';
export interface PwChallenge {
  id: string;
  week_number: number;
  year: number;
  week_start: string;
  week_end: string;
  lock_at: string;
  end_at: string;
  status: PwStatus;
  start_trading_date: string | null;
  end_trading_date: string | null;
  finalized_at: string | null;
}
export interface PwPick {
  id: string;
  entry_id: string;
  ticker: string;
  position: number;
  start_price: number | null;
  end_price: number | null;
  latest_price: number | null;
  pct_change: number | null;
}
export interface PwEntry {
  id: string;
  challenge_id: string;
  user_id: string;
  submitted_at: string;
  locked_at: string | null;
  avg_pct: number | null;
  final_rank: number | null;
}
export interface PwAccolade {
  id: string;
  challenge_id: string;
  user_id: string;
  kind: string;
  ticker: string | null;
  value: number | null;
}

/** Most relevant challenge for the lobby: prefer active > upcoming > most recent completed.
 *  Always scoped to the caller's current club (admins otherwise see every club's row). */
export function useCurrentChallenge() {
  const { club } = useClub();
  const clubId = club?.id;
  return useQuery({
    queryKey: ['pw-current-challenge', clubId],
    enabled: !!clubId,
    queryFn: async () => {
      // Try active/locked first
      const { data: act } = await supabase.from('pw_challenges').select('*')
        .eq('club_id', clubId!)
        .in('status', ['active', 'locked']).order('week_start', { ascending: false }).limit(1).maybeSingle();
      if (act) return act as PwChallenge;
      const { data: up } = await supabase.from('pw_challenges').select('*')
        .eq('club_id', clubId!)
        .eq('status', 'upcoming').order('week_start', { ascending: true }).limit(1).maybeSingle();
      if (up) return up as PwChallenge;
      const { data: done } = await supabase.from('pw_challenges').select('*')
        .eq('club_id', clubId!)
        .in('status', ['completed', 'archived']).order('week_start', { ascending: false }).limit(1).maybeSingle();
      return (done as PwChallenge) || null;
    },
    staleTime: 1000 * 60,
  });
}

export function useAllChallenges() {
  const { club } = useClub();
  const clubId = club?.id;
  return useQuery({
    queryKey: ['pw-challenges', clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase.from('pw_challenges').select('*')
        .eq('club_id', clubId!)
        .order('week_start', { ascending: false });
      if (error) throw error;
      return (data || []) as PwChallenge[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useMyEntry(challengeId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pw-entry', challengeId, user?.id],
    enabled: !!challengeId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('pw_entries').select('*, pw_picks(*)')
        .eq('challenge_id', challengeId!).eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data as (PwEntry & { pw_picks: PwPick[] }) | null;
    },
  });
}

export function useChallengeLeaderboard(challengeId?: string) {
  const { user } = useAuth();
  const { club } = useClub();
  const clubId = club?.id;
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['pw-leaderboard', challengeId, clubId, user?.id],
    enabled: !!challengeId && !!clubId,
    queryFn: async () => {
      // Look up the challenge's status + club to decide what to show.
      const { data: ch } = await supabase.from('pw_challenges')
        .select('id, club_id, status').eq('id', challengeId!).maybeSingle();
      if (!ch) return [];
      // Cross-club guard: even if RLS would allow (admin), never mix clubs.
      if ((ch as any).club_id !== clubId) return [];

      const status = (ch as any).status as PwStatus;
      let q = supabase.from('pw_entries')
        .select('*, pw_picks(*)').eq('challenge_id', challengeId!);
      // Before lock: don't reveal anyone else's portfolio — only show the viewer's own row.
      if (status === 'upcoming') {
        q = q.eq('user_id', user?.id || '00000000-0000-0000-0000-000000000000');
      } else {
        // Locked/active/completed: only entries that were actually locked in.
        q = q.not('locked_at', 'is', null);
      }
      const { data: entries, error } = await q;
      if (error) throw error;

      // Defensive: drop entries missing all 3 picks once locked.
      const rows = (entries || []).filter((e: any) =>
        status === 'upcoming' ? true : Array.isArray(e.pw_picks) && e.pw_picks.length === 3,
      );

      const userIds = [...new Set(rows.map((e: any) => e.user_id))];
      const { data: profs } = userIds.length
        ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
        : { data: [] as any[] };
      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
      return rows.map((e: any) => ({
        ...e,
        profile: profMap.get(e.user_id) || null,
      })).sort((a: any, b: any) => {
        const av = a.avg_pct ?? -Infinity;
        const bv = b.avg_pct ?? -Infinity;
        return bv - av;
      });
    },
    staleTime: 1000 * 30,
  });

  // Realtime: refresh leaderboard when picks/entries change for this challenge
  useEffect(() => {
    if (!challengeId) return;
    const channel = supabase
      .channel(`pw-leaderboard-${challengeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pw_picks' },
        () => qc.invalidateQueries({ queryKey: ['pw-leaderboard', challengeId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pw_entries', filter: `challenge_id=eq.${challengeId}` },
        () => qc.invalidateQueries({ queryKey: ['pw-leaderboard', challengeId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [challengeId, qc]);

  return query;
}

export function useChallengeAccolades(challengeId?: string) {
  const { club } = useClub();
  const clubId = club?.id;
  return useQuery({
    queryKey: ['pw-accolades', challengeId, clubId],
    enabled: !!challengeId && !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase.from('pw_accolades').select('*')
        .eq('challenge_id', challengeId!)
        .eq('club_id', clubId!);
      if (error) throw error;
      return (data || []) as PwAccolade[];
    },
  });
}

export function useSubmitPicks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, tickers }: { challengeId: string; tickers: string[] }) => {
      if (!user) throw new Error('Not signed in');
      if (tickers.length !== 3) throw new Error('Pick exactly 3 tickers');
      const unique = [...new Set(tickers.map((t) => t.toUpperCase()))];
      if (unique.length !== 3) throw new Error('Tickers must be unique');
      // Upsert entry
      const { data: existing } = await supabase.from('pw_entries').select('id')
        .eq('challenge_id', challengeId).eq('user_id', user.id).maybeSingle();
      let entryId = existing?.id as string | undefined;
      if (!entryId) {
        const { data, error } = await supabase.from('pw_entries').insert({
          challenge_id: challengeId, user_id: user.id,
          // club_id is auto-stamped by DB trigger from the parent challenge
        } as any).select('id').single();
        if (error) throw error;
        entryId = data.id;
      }
      // Replace picks (delete + insert)
      await supabase.from('pw_picks').delete().eq('entry_id', entryId!);
      const rows = unique.map((ticker, i) => ({ entry_id: entryId!, ticker, position: i + 1 }));
      // club_id is auto-stamped by DB trigger from the parent entry
      const { error: pErr } = await supabase.from('pw_picks').insert(rows as any);
      if (pErr) throw pErr;
      return { entryId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pw-entry', vars.challengeId] });
      qc.invalidateQueries({ queryKey: ['pw-leaderboard', vars.challengeId] });
    },
  });
}

export function useTickerQuote() {
  return useMutation({
    mutationFn: async (symbol: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pw-quote?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Quote failed (${res.status})`);
      return res.json();
    },
  });
}

export function usePwAdminAction() {
  return useMutation({
    mutationFn: async (payload: { action: 'open_next' | 'snapshot' | 'lock' | 'finalize'; challenge_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('pw-week-action', { body: payload });
      if (error) throw error;
      return data;
    },
  });
}
