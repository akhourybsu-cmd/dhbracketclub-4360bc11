// ═══════════════════════════════════════════════════════════════════
// READSHIFT — client-side row types
//
// The generated Supabase types (src/integrations/supabase/types.ts) are
// regenerated from the live DB and won't contain the readshift_* tables
// until this feature deploys. Per the repo convention we access those
// tables via `(supabase as any).from('readshift_*')` and cast rows to
// these hand-written shapes (which mirror the migration exactly). Swap to
// the generated types once they're regenerated post-deploy.
// ═══════════════════════════════════════════════════════════════════
import type { Phase, Signal } from './types';

export interface RsGame {
  id: string;
  club_id: string;
  created_by: string;
  name: string;
  phase: Phase;
  current_round: number;
  total_rounds: number;
  shift_hours: number;
  read_hours: number;
  reveal_hours: number;
  early_advance: boolean;
  prompt_mode: 'family' | 'adult';
  prompt_categories: string[];
  allow_custom_prompts: boolean;
  allow_reveal_explanations: boolean;
  strong_read_explanations: boolean;
  reminders_enabled: boolean;
  phase_deadline: string | null;
  paused_from_phase: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RsParticipant {
  id: string;
  club_id: string;
  game_id: string;
  user_id: string;
  active: boolean;
  joined_at: string;
  profiles?: { display_name?: string; avatar_url?: string | null } | null;
}

export interface RsRound {
  id: string;
  club_id: string;
  game_id: string;
  round_number: number;
  prompt_id: string | null;
  prompt_snapshot: string | null;
  phase: 'shift' | 'read' | 'reveal' | 'completed' | 'cancelled';
  shift_deadline: string | null;
  read_deadline: string | null;
  reveal_deadline: string | null;
  voided: boolean;
  scored_at: string | null;
}

export interface RsSignalAssignment {
  id: string;
  round_id: string;
  user_id: string;
  signal: Signal;
  frame_target_user_id: string | null;
}

export interface RsAnswer {
  id: string;
  round_id: string;
  user_id: string;
  body: string;
  locked: boolean;
  updated_at: string;
}

/** Anonymous card returned by the readshift_read_cards() RPC (no author). */
export interface RsReadCard {
  answer_id: string;
  body: string;
}

export interface RsGuess {
  id: string;
  round_id: string;
  reader_user_id: string;
  answer_id: string;
  guessed_user_id: string | null;
  is_strong_read: boolean;
  explanation: string | null;
}

export interface RsRevealAnswer {
  answerId: string;
  authorUserId: string;
  body: string;
  signal: Signal;
  frameTargetUserId: string | null;
  guessDistribution: Record<string, number>;
  correctGuessCount: number;
  targetGuessCount: number;
  signalPoints: number;
  bonuses: { name: string; points: number }[];
  strongReadCount: number;
  guesses: { reader: string; guessed: string | null; strong: boolean }[];
}

export interface RsRoundResult {
  id: string;
  game_id: string;
  round_id: string;
  detail: { answers?: RsRevealAnswer[] } & Record<string, unknown>;
  reading_points: Record<string, number>;
  signal_points: Record<string, number>;
  total_points: Record<string, number>;
}

export interface RsRoundAward {
  id: string;
  game_id: string;
  round_id: string;
  award_key: string;
  label: string;
  user_id: string;
  value: number;
}

export interface RsStats {
  club_id: string;
  user_id: string;
  games_played: number;
  games_won: number;
  total_score: number;
  rounds_played: number;
  correct_reads: number;
  eligible_reads: number;
  correct_strong_reads: number;
  strong_reads: number;
  tell_success: number;
  tell_rounds: number;
  blur_success: number;
  blur_rounds: number;
  frame_success: number;
  frame_rounds: number;
  pairings: Record<string, unknown>;
}

export interface RsComment {
  id: string;
  round_id: string;
  answer_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { display_name?: string; avatar_url?: string | null } | null;
}
