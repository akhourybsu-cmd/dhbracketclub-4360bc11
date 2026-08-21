import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';

/**
 * Per-club AI master switch (opt-out; absence of a row = enabled).
 *
 * Reads `club_ai_settings.ai_enabled` for the active club. Every AI-backed
 * feature should gate on `aiEnabled` before invoking an edge function so we
 * don't pay for a round-trip the club has turned off. The edge functions
 * ALSO enforce this server-side via `ai_gate()`, so this is a UX/cost layer,
 * not the security boundary.
 */
export function useClubAI() {
  const { club, isClubAdmin } = useClub();
  const [aiEnabled, setAiEnabledState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Mirror for stale-closure-safe rollback (see CLAUDE.md convention).
  const enabledRef = useRef(true);
  enabledRef.current = aiEnabled;

  const load = useCallback(async () => {
    if (!club) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('club_ai_settings')
        .select('ai_enabled')
        .eq('club_id', club.id)
        .maybeSingle();
      // No row → default enabled.
      const next = data ? data.ai_enabled !== false : true;
      setAiEnabledState(next);
    } catch {
      // Fail open — a read error should never silently disable a club's AI.
      setAiEnabledState(true);
    } finally {
      setLoading(false);
    }
  }, [club]);

  useEffect(() => { void load(); }, [load]);

  const setAiEnabled = useCallback(async (enabled: boolean) => {
    if (!club || !isClubAdmin) return;
    const snapshot = enabledRef.current;
    setAiEnabledState(enabled); // optimistic
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('club_ai_settings')
        .upsert({ club_id: club.id, ai_enabled: enabled }, { onConflict: 'club_id' });
      if (error) throw error;
    } catch (err) {
      setAiEnabledState(snapshot); // rollback
      throw err;
    } finally {
      setSaving(false);
    }
  }, [club, isClubAdmin]);

  return { aiEnabled, loading, saving, setAiEnabled, refresh: load };
}
