import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

export interface SeasonJoinEligibility {
  isSeasonDraft: boolean;
  rosterLocked: boolean;
  eligible: boolean;
}

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface SeasonEntryRow {
  season_id: string;
  is_playoff: boolean;
}

interface SeasonDraftRow {
  draft_id: string;
  is_playoff: boolean;
  drafts?: { status?: string } | null;
}

const OPEN_ELIGIBILITY: SeasonJoinEligibility = {
  isSeasonDraft: false,
  rosterLocked: false,
  eligible: true,
};

/** Mirrors the database season-roster guard so join controls can explain a lock before submission. */
export async function getSeasonJoinEligibility(
  draftId: string,
  userId: string,
): Promise<SeasonJoinEligibility> {
  const entryQuery = (supabase as any)
      .from('draft_season_entries')
      .select('season_id, is_playoff')
      .eq('draft_id', draftId)
      .maybeSingle();
  const { data: entry, error: entryError } = await withTimeout<QueryResult<SeasonEntryRow>>(
    Promise.resolve(entryQuery),
    QUERY_TIMEOUT_MS,
    'season entry eligibility',
  );

  if (entryError) throw entryError;
  if (!entry?.season_id) return OPEN_ELIGIBILITY;

  const entriesQuery = (supabase as any)
      .from('draft_season_entries')
      .select('draft_id, is_playoff, drafts:draft_id(status)')
      .eq('season_id', entry.season_id);
  const { data: entries, error: entriesError } = await withTimeout<QueryResult<SeasonDraftRow[]>>(
    Promise.resolve(entriesQuery),
    QUERY_TIMEOUT_MS,
    'season roster eligibility',
  );

  if (entriesError) throw entriesError;
  const regularEntries = (entries ?? []).filter(row => !row.is_playoff);
  const rosterLocked = Boolean(entry.is_playoff) || regularEntries.some(row => row.drafts?.status !== 'setup');
  if (!rosterLocked) return { isSeasonDraft: true, rosterLocked: false, eligible: true };

  const regularDraftIds = regularEntries.map(row => row.draft_id).filter(Boolean);
  if (regularDraftIds.length === 0) {
    return { isSeasonDraft: true, rosterLocked: true, eligible: false };
  }

  const rosterQuery = supabase
      .from('draft_participants')
      .select('id')
      .eq('user_id', userId)
      .in('draft_id', regularDraftIds)
      .limit(1)
      .maybeSingle();
  const { data: rosterRow, error: rosterError } = await withTimeout<QueryResult<{ id: string }>>(
    Promise.resolve(rosterQuery),
    QUERY_TIMEOUT_MS,
    'season player eligibility',
  );

  if (rosterError) throw rosterError;
  return { isSeasonDraft: true, rosterLocked: true, eligible: Boolean(rosterRow) };
}