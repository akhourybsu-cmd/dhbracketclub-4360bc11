// ═══════════════════════════════════════════════════════════════════
// READSHIFT — phase state machine (pure)
//
// The DB/edge layer is the authority on WHEN a transition happens
// (deadlines, everyone-finished, commissioner action) and applies it
// atomically with compare-and-swap on a version column. This module is
// the authority on WHICH transitions are legal, so both the edge
// function and the client can validate consistently.
// ═══════════════════════════════════════════════════════════════════
import type { Phase } from './types';

/** Reason a transition was requested — used to gate legality. */
export type TransitionTrigger =
  | 'start' // lobby → shift (commissioner)
  | 'advance' // deadline reached or everyone finished
  | 'pause'
  | 'resume'
  | 'cancel';

export interface PhaseContext {
  /** 1-based current round. */
  round: number;
  /** Total configured rounds. */
  totalRounds: number;
  /** Phase to resume into when un-pausing. */
  resumeInto?: Phase;
}

const ACTIVE_PHASES: Phase[] = ['shift', 'read', 'reveal'];

/** Legal `advance` progressions WITHIN the normal loop (round bookkeeping handled by caller). */
const ADVANCE_NEXT: Record<string, Phase | 'reveal->next'> = {
  shift: 'read',
  read: 'reveal',
  // reveal advances to either the next round's shift or completed — see resolveAdvance.
};

/**
 * Returns the target phase for a given trigger, or null if illegal.
 * `round`/`totalRounds` decide whether reveal loops to a new shift or
 * ends the game.
 */
export function resolveTransition(
  from: Phase,
  trigger: TransitionTrigger,
  ctx: PhaseContext,
): { to: Phase; nextRound?: number } | null {
  switch (trigger) {
    case 'start':
      return from === 'lobby' ? { to: 'shift', nextRound: 1 } : null;

    case 'advance': {
      if (from === 'shift') return { to: 'read' };
      if (from === 'read') return { to: 'reveal' };
      if (from === 'reveal') {
        if (ctx.round < ctx.totalRounds) return { to: 'shift', nextRound: ctx.round + 1 };
        return { to: 'completed' };
      }
      return null;
    }

    case 'pause':
      return ACTIVE_PHASES.includes(from) ? { to: 'paused' } : null;

    case 'resume': {
      if (from !== 'paused') return null;
      const target = ctx.resumeInto;
      if (!target || !ACTIVE_PHASES.includes(target)) return null;
      return { to: target };
    }

    case 'cancel':
      // Any non-terminal state may be cancelled by an authorized actor.
      return from === 'completed' || from === 'cancelled' ? null : { to: 'cancelled' };

    default:
      return null;
  }
}

/** Pure legality check (ignores round bookkeeping). */
export function canTransition(from: Phase, to: Phase, ctx: PhaseContext): boolean {
  for (const trigger of ['start', 'advance', 'pause', 'resume', 'cancel'] as TransitionTrigger[]) {
    const res = resolveTransition(from, trigger, ctx);
    if (res && res.to === to) return true;
  }
  return false;
}

/** All the illegal transitions the spec calls out, for explicit testing. */
export const KNOWN_ILLEGAL: Array<[Phase, Phase]> = [
  ['read', 'shift'], // no going back within a round
  ['reveal', 'read'], // scoring is finalized
  ['completed', 'shift'],
  ['completed', 'read'],
  ['completed', 'reveal'],
  ['cancelled', 'shift'],
  ['lobby', 'read'],
  ['lobby', 'reveal'],
];

export { ADVANCE_NEXT };
