import { describe, expect, it } from 'vitest';
import { evaluateRequirements } from '@/lib/journey/requirements';
import { applyEffects } from '@/lib/journey/effects';
import { EMPTY_RUN_STATE } from '@/lib/journey/types';
import type { RunState } from '@/lib/journey/types';

const base = (over: Partial<RunState> = {}): RunState => ({ ...EMPTY_RUN_STATE, ...over }) as RunState;

describe('journey requirement engine', () => {
  it('treats no requirements as always available', () => {
    expect(evaluateRequirements(null, base())).toBe(true);
    expect(evaluateRequirements([] as any, base())).toBe(true);
  });

  it('checks flags, items and stats', () => {
    const s = base({ flags: { met_warden: true }, inventory: { lantern: 2 }, stats: { wits: 3 } });
    expect(evaluateRequirements({ type: 'flag_exists', key: 'met_warden' } as any, s)).toBe(true);
    expect(evaluateRequirements({ type: 'flag_not_exists', key: 'met_warden' } as any, s)).toBe(false);
    expect(evaluateRequirements({ type: 'has_item', key: 'lantern', value: 2 } as any, s)).toBe(true);
    expect(evaluateRequirements({ type: 'has_item', key: 'lantern', value: 3 } as any, s)).toBe(false);
    expect(evaluateRequirements({ type: 'stat_minimum', key: 'wits', value: 3 } as any, s)).toBe(true);
    expect(evaluateRequirements({ type: 'stat_maximum', key: 'wits', value: 2 } as any, s)).toBe(false);
  });

  it('honours all / any groups', () => {
    const s = base({ flags: { a: true }, gold: 10 });
    const conditions = [{ type: 'flag_exists', key: 'a' }, { type: 'flag_exists', key: 'b' }];
    const all = { type: 'all', conditions } as any;
    const any = { type: 'any', conditions } as any;
    expect(evaluateRequirements(all, s)).toBe(false);
    expect(evaluateRequirements(any, s)).toBe(true);
  });

  it('remembers previous choices', () => {
    const s = base({ choices_made: ['spared_the_thief'] });
    expect(evaluateRequirements({ type: 'previous_choice', key: 'spared_the_thief' } as any, s)).toBe(true);
    expect(evaluateRequirements({ type: 'previous_choice', key: 'other' } as any, s)).toBe(false);
  });
});

describe('journey effect engine', () => {
  it('never mutates the input state', () => {
    const s = base({ gold: 5 });
    const next = applyEffects([{ type: 'gain_gold', value: 3 }] as any, s);
    expect(s.gold).toBe(5);
    expect(next.gold).toBe(8);
  });

  it('clamps spending and item removal at zero', () => {
    const s = base({ gold: 2, inventory: { rope: 1 } });
    const next = applyEffects([
      { type: 'lose_gold', value: 10 },
      { type: 'remove_item', key: 'rope', value: 5 },
    ] as any, s);
    expect(next.gold).toBe(0);
    expect(next.inventory.rope).toBe(0);
  });

  it('accumulates items, xp and relationships', () => {
    const next = applyEffects([
      { type: 'add_item', key: 'lantern', value: 2 },
      { type: 'add_item', key: 'lantern', value: 1 },
      { type: 'gain_xp', value: 40 },
      { type: 'increase_relationship', key: 'warden', value: 2 },
      { type: 'decrease_relationship', key: 'warden', value: 5 },
    ] as any, base());
    expect(next.inventory.lantern).toBe(3);
    expect(next.xp).toBe(40);
    expect(next.relationships.warden).toBe(-3);
  });

  it('applies flags and variables', () => {
    const next = applyEffects([
      { type: 'set_flag', key: 'met_warden' },
      { type: 'set_variable', key: 'tone', value: 'grim' },
      { type: 'increment_variable', key: 'suspicion', value: 2 },
    ] as any, base());
    expect(next.flags.met_warden).toBe(true);
    expect(next.variables.tone).toBe('grim');
    expect(next.variables.suspicion).toBe(2);
  });

  it('round-trips: effects then requirements agree', () => {
    const after = applyEffects([{ type: 'add_item', key: 'key_bronze', value: 1 }] as any, base());
    expect(evaluateRequirements({ type: 'has_item', key: 'key_bronze' } as any, after)).toBe(true);
  });
});
