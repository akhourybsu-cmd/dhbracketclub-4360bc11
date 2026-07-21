import { describe, it, expect } from 'vitest';
import { resolveTransition, canTransition, KNOWN_ILLEGAL } from '@/lib/readshift/phaseEngine';
import type { Phase } from '@/lib/readshift/types';

const ctx = (round: number, totalRounds: number, resumeInto?: Phase) => ({ round, totalRounds, resumeInto });

describe('READSHIFT phase engine — valid transitions', () => {
  it('lobby → shift on start (round 1)', () => {
    expect(resolveTransition('lobby', 'start', ctx(0, 5))).toEqual({ to: 'shift', nextRound: 1 });
  });
  it('shift → read on advance', () => {
    expect(resolveTransition('shift', 'advance', ctx(1, 5))).toEqual({ to: 'read' });
  });
  it('read → reveal on advance', () => {
    expect(resolveTransition('read', 'advance', ctx(1, 5))).toEqual({ to: 'reveal' });
  });
  it('reveal → next round shift when rounds remain', () => {
    expect(resolveTransition('reveal', 'advance', ctx(2, 5))).toEqual({ to: 'shift', nextRound: 3 });
  });
  it('reveal → completed after the final round', () => {
    expect(resolveTransition('reveal', 'advance', ctx(5, 5))).toEqual({ to: 'completed' });
  });
  it('active → paused, then resume back into the same phase', () => {
    expect(resolveTransition('shift', 'pause', ctx(1, 5))).toEqual({ to: 'paused' });
    expect(resolveTransition('paused', 'resume', ctx(1, 5, 'read'))).toEqual({ to: 'read' });
  });
  it('non-terminal → cancelled', () => {
    expect(resolveTransition('shift', 'cancel', ctx(1, 5))).toEqual({ to: 'cancelled' });
    expect(resolveTransition('lobby', 'cancel', ctx(0, 5))).toEqual({ to: 'cancelled' });
  });
});

describe('READSHIFT phase engine — invalid transitions', () => {
  it('rejects start from a non-lobby phase', () => {
    expect(resolveTransition('shift', 'start', ctx(1, 5))).toBeNull();
  });
  it('rejects advance from lobby/completed/cancelled', () => {
    expect(resolveTransition('lobby', 'advance', ctx(0, 5))).toBeNull();
    expect(resolveTransition('completed', 'advance', ctx(5, 5))).toBeNull();
    expect(resolveTransition('cancelled', 'advance', ctx(1, 5))).toBeNull();
  });
  it('rejects resume without a valid resume-into phase', () => {
    expect(resolveTransition('paused', 'resume', ctx(1, 5))).toBeNull();
    expect(resolveTransition('paused', 'resume', ctx(1, 5, 'lobby'))).toBeNull();
  });
  it('rejects pause from terminal/lobby phases', () => {
    expect(resolveTransition('completed', 'pause', ctx(5, 5))).toBeNull();
    expect(resolveTransition('lobby', 'pause', ctx(0, 5))).toBeNull();
  });
  it('rejects cancelling a finished/cancelled game', () => {
    expect(resolveTransition('completed', 'cancel', ctx(5, 5))).toBeNull();
    expect(resolveTransition('cancelled', 'cancel', ctx(5, 5))).toBeNull();
  });
  it('all spec-listed illegal transitions are rejected by canTransition', () => {
    for (const [from, to] of KNOWN_ILLEGAL) {
      expect(canTransition(from, to, ctx(1, 5, 'shift')), `${from} → ${to}`).toBe(false);
    }
  });
});

describe('READSHIFT phase engine — full loop', () => {
  it('drives a 3-round game lobby → … → completed with no illegal steps', () => {
    const totalRounds = 3;
    let phase: Phase = 'lobby';
    let round = 0;
    const visited: string[] = [];

    let step = resolveTransition(phase, 'start', ctx(round, totalRounds));
    expect(step).not.toBeNull();
    phase = step!.to;
    round = step!.nextRound ?? round;
    visited.push(`${phase}#${round}`);

    for (let guard = 0; guard < 50 && phase !== 'completed'; guard++) {
      const next = resolveTransition(phase, 'advance', ctx(round, totalRounds));
      expect(next, `advance from ${phase} r${round}`).not.toBeNull();
      phase = next!.to;
      if (next!.nextRound) round = next!.nextRound;
      visited.push(`${phase}#${round}`);
    }

    expect(phase).toBe('completed');
    expect(visited).toEqual([
      'shift#1', 'read#1', 'reveal#1',
      'shift#2', 'read#2', 'reveal#2',
      'shift#3', 'read#3', 'reveal#3',
      'completed#3',
    ]);
  });
});
