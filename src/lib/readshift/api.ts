// ═══════════════════════════════════════════════════════════════════
// READSHIFT — client data-access layer
//
// Thin, typed wrappers over Supabase for every READSHIFT surface. Uses the
// repo's `(supabase as any).from('readshift_*')` escape hatch (the tables
// aren't in the generated types until this feature deploys). All phase/
// privacy enforcement lives server-side (RLS + the read RPC + the
// readshift-advance edge function) — these are just the calls.
// ═══════════════════════════════════════════════════════════════════
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLogger';
import { ANSWER_MAX_CHARS, DEFAULT_ROUNDS, DEFAULT_SHIFT_HOURS, DEFAULT_READ_HOURS, DEFAULT_REVEAL_HOURS } from './constants';
import type {
  RsGame, RsParticipant, RsRound, RsSignalAssignment, RsAnswer, RsReadCard,
  RsGuess, RsRoundResult, RsRoundAward, RsStats, RsComment,
} from './dbTypes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type PhaseTrigger = 'start' | 'advance' | 'pause' | 'resume' | 'cancel';

export interface CreateGameInput {
  clubId: string;
  createdBy: string;
  name: string;
  totalRounds?: number;
  shiftHours?: number;
  readHours?: number;
  revealHours?: number;
  earlyAdvance?: boolean;
  promptMode?: 'family' | 'adult';
  promptCategories?: string[];
  allowCustomPrompts?: boolean;
  allowRevealExplanations?: boolean;
  strongReadExplanations?: boolean;
  remindersEnabled?: boolean;
}

/** Create a game and add the creator as the first (host) participant. */
export async function createGame(input: CreateGameInput): Promise<RsGame> {
  const { data: game, error } = await sb
    .from('readshift_games')
    .insert({
      club_id: input.clubId,
      created_by: input.createdBy,
      name: input.name.trim().slice(0, 80),
      total_rounds: input.totalRounds ?? DEFAULT_ROUNDS,
      shift_hours: input.shiftHours ?? DEFAULT_SHIFT_HOURS,
      read_hours: input.readHours ?? DEFAULT_READ_HOURS,
      reveal_hours: input.revealHours ?? DEFAULT_REVEAL_HOURS,
      early_advance: input.earlyAdvance ?? true,
      prompt_mode: input.promptMode ?? 'family',
      prompt_categories: input.promptCategories ?? [],
      allow_custom_prompts: input.allowCustomPrompts ?? false,
      allow_reveal_explanations: input.allowRevealExplanations ?? true,
      strong_read_explanations: input.strongReadExplanations ?? true,
      reminders_enabled: input.remindersEnabled ?? true,
    })
    .select()
    .single();
  if (error) throw error;

  await sb.from('readshift_participants').insert({
    club_id: input.clubId, game_id: game.id, user_id: input.createdBy,
  });
  await logActivity(input.createdBy, {
    event_type: 'readshift_created', target_type: 'readshift', target_id: game.id,
    metadata: { name: input.name.trim() },
  });
  return game as RsGame;
}

export async function listClubGames(clubId: string): Promise<RsGame[]> {
  const { data, error } = await sb
    .from('readshift_games')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RsGame[];
}

export async function getGame(gameId: string): Promise<RsGame | null> {
  const { data } = await sb.from('readshift_games').select('*').eq('id', gameId).maybeSingle();
  return (data as RsGame) ?? null;
}

export async function getParticipants(gameId: string): Promise<RsParticipant[]> {
  const { data, error } = await sb
    .from('readshift_participants')
    .select('*, profiles:user_id(display_name, avatar_url)')
    .eq('game_id', gameId)
    .order('joined_at');
  if (error) throw error;
  return (data ?? []) as RsParticipant[];
}

export async function joinGame(gameId: string, clubId: string, userId: string): Promise<void> {
  // Re-activate if a soft-removed row exists, else insert.
  const { data: existing } = await sb.from('readshift_participants').select('id').eq('game_id', gameId).eq('user_id', userId).maybeSingle();
  if (existing) {
    await sb.from('readshift_participants').update({ active: true }).eq('id', existing.id);
  } else {
    await sb.from('readshift_participants').insert({ club_id: clubId, game_id: gameId, user_id: userId });
  }
  await logActivity(userId, { event_type: 'readshift_joined', target_type: 'readshift', target_id: gameId });
}

export async function leaveGame(gameId: string, userId: string): Promise<void> {
  // Soft-inactive so historical rounds stay intact.
  await sb.from('readshift_participants').update({ active: false }).eq('game_id', gameId).eq('user_id', userId);
}

/** Commissioner removes a participant before the game starts. */
export async function removeParticipant(gameId: string, userId: string): Promise<void> {
  await sb.from('readshift_participants').update({ active: false }).eq('game_id', gameId).eq('user_id', userId);
}

// ── Phase transitions (delegated to the server-authoritative edge fn) ──
export async function triggerPhase(gameId: string, trigger: PhaseTrigger): Promise<{ phase?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('readshift-advance', { body: { game_id: gameId, trigger } });
  if (error) throw error;
  return data as { phase?: string; error?: string };
}
/** Fallback "advance if due" call — safe to fire whenever the game screen loads. */
export async function pokeAdvance(gameId: string): Promise<void> {
  try { await supabase.functions.invoke('readshift-advance', { body: { game_id: gameId, trigger: 'advance' } }); } catch { /* non-fatal */ }
}

// ── Rounds & the player's private state ──
export async function getRound(gameId: string, roundNumber: number): Promise<RsRound | null> {
  const { data } = await sb.from('readshift_rounds').select('*').eq('game_id', gameId).eq('round_number', roundNumber).maybeSingle();
  return (data as RsRound) ?? null;
}
export async function getRounds(gameId: string): Promise<RsRound[]> {
  const { data } = await sb.from('readshift_rounds').select('*').eq('game_id', gameId).order('round_number');
  return (data ?? []) as RsRound[];
}
/** Own Signal assignment for a round (RLS returns only the caller's row). */
export async function getMyAssignment(roundId: string): Promise<RsSignalAssignment | null> {
  const { data } = await sb.from('readshift_signal_assignments').select('*').eq('round_id', roundId).maybeSingle();
  return (data as RsSignalAssignment) ?? null;
}
export async function getMyAnswer(roundId: string): Promise<RsAnswer | null> {
  const { data } = await sb.from('readshift_answers').select('*').eq('round_id', roundId).maybeSingle();
  return (data as RsAnswer) ?? null;
}

/** Save (or update) the caller's answer for the round. Sanitized + length-capped. */
export async function saveAnswer(roundId: string, clubId: string, userId: string, body: string): Promise<void> {
  const clean = body.replace(/\s+/g, ' ').trim().slice(0, ANSWER_MAX_CHARS);
  const { data: existing } = await sb.from('readshift_answers').select('id, locked').eq('round_id', roundId).maybeSingle();
  if (existing) {
    if (existing.locked) throw new Error('This answer is locked.');
    await sb.from('readshift_answers').update({ body: clean }).eq('id', existing.id);
  } else {
    await sb.from('readshift_answers').insert({ round_id: roundId, club_id: clubId, user_id: userId, body: clean });
  }
}

// ── Read phase ──
export async function getReadCards(roundId: string): Promise<RsReadCard[]> {
  const { data, error } = await sb.rpc('readshift_read_cards', { _round_id: roundId });
  if (error) throw error;
  return (data ?? []) as RsReadCard[];
}
export async function getMyGuesses(roundId: string): Promise<RsGuess[]> {
  const { data } = await sb.from('readshift_guesses').select('*').eq('round_id', roundId);
  return (data ?? []) as RsGuess[];
}
export async function saveGuess(roundId: string, clubId: string, readerUserId: string, answerId: string, guessedUserId: string | null): Promise<void> {
  const { data: existing } = await sb.from('readshift_guesses').select('id').eq('round_id', roundId).eq('reader_user_id', readerUserId).eq('answer_id', answerId).maybeSingle();
  if (existing) {
    await sb.from('readshift_guesses').update({ guessed_user_id: guessedUserId }).eq('id', existing.id);
  } else {
    await sb.from('readshift_guesses').insert({ round_id: roundId, club_id: clubId, reader_user_id: readerUserId, answer_id: answerId, guessed_user_id: guessedUserId });
  }
}
/** Mark exactly one answer as the reader's Strong Read (clears any prior). */
export async function setStrongRead(roundId: string, clubId: string, readerUserId: string, answerId: string, explanation?: string): Promise<void> {
  await sb.from('readshift_guesses').update({ is_strong_read: false }).eq('round_id', roundId).eq('reader_user_id', readerUserId);
  const { data: existing } = await sb.from('readshift_guesses').select('id').eq('round_id', roundId).eq('reader_user_id', readerUserId).eq('answer_id', answerId).maybeSingle();
  if (existing) {
    await sb.from('readshift_guesses').update({ is_strong_read: true, explanation: explanation ?? null }).eq('id', existing.id);
  } else {
    await sb.from('readshift_guesses').insert({ round_id: roundId, club_id: clubId, reader_user_id: readerUserId, answer_id: answerId, is_strong_read: true, explanation: explanation ?? null });
  }
}

// ── Reveal / results / awards / stats ──
export async function getRoundResult(roundId: string): Promise<RsRoundResult | null> {
  const { data } = await sb.from('readshift_round_results').select('*').eq('round_id', roundId).maybeSingle();
  return (data as RsRoundResult) ?? null;
}
export async function getGameResults(gameId: string): Promise<RsRoundResult[]> {
  const { data } = await sb.from('readshift_round_results').select('*').eq('game_id', gameId);
  return (data ?? []) as RsRoundResult[];
}
export async function getRoundAwards(roundId: string): Promise<RsRoundAward[]> {
  const { data } = await sb.from('readshift_round_awards').select('*').eq('round_id', roundId);
  return (data ?? []) as RsRoundAward[];
}
export async function getMyStats(clubId: string, userId: string): Promise<RsStats | null> {
  const { data } = await sb.from('readshift_stats').select('*').eq('club_id', clubId).eq('user_id', userId).maybeSingle();
  return (data as RsStats) ?? null;
}

// ── Reactions (generic table) & comments (post-reveal only) ──
export async function toggleReaction(answerId: string, userId: string, reactionType: string): Promise<void> {
  const { data: existing } = await sb.from('reactions').select('id').eq('user_id', userId).eq('target_type', 'readshift_answer').eq('target_id', answerId).eq('reaction_type', reactionType).maybeSingle();
  if (existing) {
    await sb.from('reactions').delete().eq('id', existing.id);
  } else {
    await sb.from('reactions').insert({ user_id: userId, target_type: 'readshift_answer', target_id: answerId, reaction_type: reactionType });
  }
}
export async function getComments(roundId: string): Promise<RsComment[]> {
  const { data } = await sb.from('readshift_comments').select('*, profiles:user_id(display_name, avatar_url)').eq('round_id', roundId).order('created_at');
  return (data ?? []) as RsComment[];
}
export async function addComment(roundId: string, clubId: string, userId: string, content: string, answerId?: string): Promise<void> {
  const clean = content.trim().slice(0, 500);
  if (!clean) return;
  await sb.from('readshift_comments').insert({ round_id: roundId, club_id: clubId, user_id: userId, content: clean, answer_id: answerId ?? null });
}
