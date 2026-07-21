// READSHIFT — React data hooks.
//
// Follows the repo's perpetual-loading defense: every query is wrapped in
// withTimeout and the outer hydrate is time-boxed, so a hung fetch can
// never trap the user on a skeleton. Realtime keeps the lobby/game live;
// pokeAdvance() lets an opened game self-heal an expired phase.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import * as api from '@/lib/readshift/api';
import type { RsGame, RsParticipant } from '@/lib/readshift/dbTypes';

export function useReadshiftGames(clubId: string | null | undefined) {
  const [games, setGames] = useState<RsGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clubId) { setGames([]); setLoading(false); return; }
    try {
      const rows = await withTimeout(api.listClubGames(clubId), QUERY_TIMEOUT_MS, 'readshift games');
      setGames(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { games, loading, error, refresh };
}

export function useReadshiftGame(gameId: string | undefined) {
  const [game, setGame] = useState<RsGame | null>(null);
  const [participants, setParticipants] = useState<RsParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pokedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!gameId) { setLoading(false); return; }
    try {
      const [g, p] = await withTimeout(
        Promise.all([
          withTimeout(api.getGame(gameId), QUERY_TIMEOUT_MS, 'rs game'),
          withTimeout(api.getParticipants(gameId), QUERY_TIMEOUT_MS, 'rs participants'),
        ]),
        HYDRATE_TIMEOUT_MS,
        'rs game hydrate',
      );
      setGame(g);
      setParticipants(p);
      setError(null);
      // Self-heal an expired active phase the first time we see the game.
      if (!pokedRef.current && g && ['shift', 'read', 'reveal'].includes(g.phase) && g.phase_deadline && new Date(g.phase_deadline).getTime() <= Date.now()) {
        pokedRef.current = true;
        void api.pokeAdvance(gameId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Realtime: refetch on any change to this game or its participant list.
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`readshift-game-${gameId}`)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'readshift_games', filter: `id=eq.${gameId}` }, () => void refresh())
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'readshift_participants', filter: `game_id=eq.${gameId}` }, () => void refresh())
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'readshift_rounds', filter: `game_id=eq.${gameId}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [gameId, refresh]);

  return { game, participants, loading, error, refresh };
}
