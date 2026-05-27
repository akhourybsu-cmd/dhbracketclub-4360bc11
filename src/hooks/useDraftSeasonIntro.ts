import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import type { DraftSeason } from '@/hooks/useDraftSeasons';

export interface DraftSeasonIntro {
  id?: string;
  season_id: string;
  club_id: string;
  season_subtitle: string | null;
  season_theme: string | null;
  commissioner_message: string | null;
  hero_summary: string | null;
  changes: string[];
  season_format: string[];
  scoring_notes: string[];
  ai_judging_notes: string[];
  dispute_notes: string[];
  important_dates: string[];
  call_to_action_label: string;
  is_active: boolean;
}

/** Default content shown when a season has no custom intro row yet. */
export function getDefaultIntro(season: DraftSeason | null, clubId: string | null): DraftSeasonIntro {
  return {
    season_id: season?.id ?? '',
    club_id: clubId ?? '',
    season_subtitle: 'A cleaner, sharper, more impartial Draft Arena season.',
    season_theme: null,
    commissioner_message:
      'This season is focused on making drafts feel fairer, clearer, and easier to follow. Picks will be judged more directly on their own merit, disputes will be easier to understand, and the Draft Arena should feel smoother from start to finish.',
    hero_summary:
      'This season introduces more impartial AI judging, clearer dispute outcomes, and a smoother commissioner review process.',
    changes: [
      'Each pick is now judged independently on its own merit.',
      'The AI no longer penalizes redundancy or lack of synergy unless the category specifically requires it.',
      'Commissioners can resolve, dismiss, or reject disputes.',
      'Rejected disputes include a commissioner rationale visible on the pick.',
      'Season info can be reviewed anytime from Draft Arena.',
    ],
    season_format: [
      'Drafts will continue to be organized through the Draft Arena.',
      'Every pick is scored based on category strength and defensibility.',
      'Commissioners retain final authority on disputed picks.',
      'Season rankings and draft results stay visible throughout the season.',
    ],
    scoring_notes: [
      'Standard placement points apply: 1st = 10, 2nd = 7, 3rd = 5, 4th = 3, 5th = 2.',
      'Your best 10 of 12 drafts count toward season standings.',
    ],
    ai_judging_notes: [
      'Every pick is evaluated independently.',
      'The AI judges category fit, quality, influence, defensibility, and overall ranking.',
      'You will not be penalized for drafting similar picks across your board.',
      'Synergy only matters when the draft category explicitly requires it.',
    ],
    dispute_notes: [
      'Users may dispute picks when needed.',
      'Commissioners can resolve, dismiss, or reject disputes.',
      'Rejected disputes include a visible explanation from the commissioner.',
      'Resolved decisions are saved with timestamp and commissioner identity.',
    ],
    important_dates: [],
    call_to_action_label: 'Enter Draft Arena',
    is_active: true,
  };
}

/** Hook: load intro content + acknowledgement state for the current season. */
export function useDraftSeasonIntro(season: DraftSeason | null) {
  const { user } = useAuth();
  const { club } = useClub();
  const [intro, setIntro] = useState<DraftSeasonIntro | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!season || !club) { setLoading(false); return; }
    setLoading(true);

    const [introRes, ackRes] = await Promise.all([
      supabase
        .from('draft_season_intros' as any)
        .select('*')
        .eq('season_id', season.id)
        .maybeSingle(),
      user
        ? supabase
            .from('draft_season_acknowledgements' as any)
            .select('id')
            .eq('user_id', user.id)
            .eq('season_id', season.id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    const fallback = getDefaultIntro(season, club.id);
    const row = (introRes as any)?.data;
    if (row) {
      setIntro({
        ...fallback,
        ...row,
        changes: Array.isArray(row.changes) ? row.changes : fallback.changes,
        season_format: Array.isArray(row.season_format) ? row.season_format : fallback.season_format,
        scoring_notes: Array.isArray(row.scoring_notes) ? row.scoring_notes : fallback.scoring_notes,
        ai_judging_notes: Array.isArray(row.ai_judging_notes) ? row.ai_judging_notes : fallback.ai_judging_notes,
        dispute_notes: Array.isArray(row.dispute_notes) ? row.dispute_notes : fallback.dispute_notes,
        important_dates: Array.isArray(row.important_dates) ? row.important_dates : fallback.important_dates,
      });
    } else {
      setIntro(fallback);
    }

    setAcknowledged(!!(ackRes as any)?.data);
    setLoading(false);
  }, [season, club, user]);

  useEffect(() => { load(); }, [load]);

  const acknowledge = useCallback(async () => {
    if (!season || !club || !user) return;
    setAcknowledged(true); // optimistic
    const { error } = await supabase
      .from('draft_season_acknowledgements' as any)
      .upsert(
        { user_id: user.id, club_id: club.id, season_id: season.id, acknowledged_at: new Date().toISOString() } as any,
        { onConflict: 'user_id,club_id,season_id' }
      );
    if (error) {
      setAcknowledged(false);
      throw error;
    }
  }, [season, club, user]);

  const saveIntro = useCallback(async (patch: Partial<DraftSeasonIntro>) => {
    if (!season || !club) return;
    const payload = {
      season_id: season.id,
      club_id: club.id,
      ...intro,
      ...patch,
    };
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;
    const { error } = await supabase
      .from('draft_season_intros' as any)
      .upsert(payload as any, { onConflict: 'season_id' });
    if (error) throw error;
    await load();
  }, [season, club, intro, load]);

  return { intro, acknowledged, loading, acknowledge, saveIntro, reload: load };
}
