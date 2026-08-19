import { Heart, Shield, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CombatState } from '@/lib/runedelve/combatEngine';
import { MAX_MANA } from '@/lib/runedelve/combatEngine';
import { getClass, type HeroClass } from '@/lib/runedelve/classConfig';

interface Props {
  state: CombatState;
  cls: HeroClass;
  onAbility: () => void;
  /** Mana orbs required to cast (Mage T4 Deep Reserve lowers this to 2). */
  manaCost?: number;
}

export function HeroStatusBar({ state, cls, onAbility, manaCost = MAX_MANA }: Props) {
  const def = getClass(cls);
  const cost = Math.max(1, Math.min(MAX_MANA, manaCost));
  const ready = state.mana >= cost;
  const hpPct = Math.round((state.hp / state.maxHp) * 100);
  return (
    // V2 — fantasy panel wrapper: gilded-stone treatment matches the
    // rune board frame so the HUD reads as an enchanted artifact
    // strip rather than a generic status bar.
    <div className="w-full space-y-2 rd-fantasy-panel px-3 py-2.5">
      <div className="flex items-center gap-2" data-fx-target="hp">
        <Heart className={cn('w-4 h-4', hpPct < 35 && 'rd-breath')} style={{ color: 'hsl(var(--destructive))' }} />
        <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden relative" data-fx-hp-glow-target>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${hpPct}%`,
              background: hpPct > 40 ? 'linear-gradient(90deg, hsl(var(--success)), hsl(var(--success) / 0.7))' : 'linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.7))',
            }}
          />
        </div>
        <span className="text-[11px] font-mono font-bold tabular-nums w-14 text-right">
          {state.hp} / {state.maxHp}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1" data-fx-target="mana">
          {Array.from({ length: MAX_MANA }).map((_, i) => (
            <div
              key={i}
              className={cn('w-3 h-3 rounded-full transition-all')}
              style={{
                background: i < state.mana
                  ? 'radial-gradient(circle, hsl(215 75% 60%), hsl(215 75% 40%))'
                  : 'hsl(var(--muted) / 0.5)',
                boxShadow: i < state.mana ? '0 0 8px hsl(215 75% 60% / 0.6)' : 'none',
                border: '1px solid hsl(var(--border) / 0.5)',
              }}
            />
          ))}
        </div>
        {state.shieldTurns > 0 && (
          <span
            data-fx-target="shield"
            className="flex items-center gap-1 text-[10px] font-bold text-gold"
            title={cls === 'warrior' ? 'Reflects 40% of damage taken' : 'Reflects 25% of damage taken'}
            aria-label={cls === 'warrior' ? 'Shield active — reflects 40% of damage taken' : 'Shield active — reflects 25% of damage taken'}
          >
            <Shield className="w-3 h-3" /> {state.shieldTurns}
          </span>
        )}
        {state.shadowstepActive && (
          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'hsl(var(--gold))' }}>
            <Sparkles className="w-3 h-3" /> Shadowstep
          </span>
        )}
        <button
          type="button"
          onClick={onAbility}
          disabled={!ready}
          className={cn(
            'ml-auto h-9 px-3 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 btn-press transition-all',
            ready ? 'text-white rd-shimmer rd-btn-juice' : 'text-muted-foreground bg-muted/40',
          )}
          style={ready ? {
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
            boxShadow: '0 0 16px hsl(var(--primary) / 0.4)',
          } : undefined}
        >
          <Zap className="w-3.5 h-3.5" /> {def.abilityName}
        </button>
      </div>
    </div>
  );
}
