import { TOWER_KINDS } from '@/lib/nexus/towers';
import { useCallback, useEffect, useRef } from 'react';
import { getSoundSettings, type SoundCategory } from './useSoundSettings';
import type { BattleEvent, TowerKind, AbilityKind } from '@/lib/nexus/types';

/**
 * Themed Nexus Defense sound family.
 *
 * Procedurally synthesised sci-fi cues built on the same Web Audio toolkit
 * pattern used by useRuneDelveSfx — short, layered, mobile-safe.  Every cue
 * passes through the central useSoundSettings store (master + per-category
 * mute) and emits independent navigator.vibrate haptics where supported.
 *
 * The hook also exposes `consumeEvents(events)` which walks the engine's
 * BattleEvent stream and fires the right cues for kills, leaks, abilities
 * and shot bursts (rate-limited so dense waves never drown the mix).
 */

export type NxSfxCue =
  // UI / actions
  | 'ui.tap'
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'invalid'
  // Towers
  | `shot.${TowerKind}`
  // Combat feedback
  | 'enemy.hit'
  | 'enemy.die'
  | 'enemy.die.boss'
  | 'leak'
  // Abilities
  | 'ability.ready'
  | `ability.cast.${AbilityKind}`
  // Wave / outcome
  | 'wave.start'
  | 'wave.clear'
  | 'victory'
  | 'defeat';

function categoryFor(cue: NxSfxCue): SoundCategory {
  if (cue === 'ui.tap' || cue === 'invalid') return 'ui';
  if (cue === 'wave.clear' || cue === 'victory' || cue === 'defeat') return 'rewards';
  return 'combat';
}

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state === 'closed') {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
    }
    if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  } catch { return null; }
}

/* ─── Synth toolkit (mirrors useRuneDelveSfx) ─────────────────────── */

interface ToneOpts {
  freq: number; type?: OscillatorType; start?: number; dur?: number;
  attack?: number; release?: number; peak?: number; detune?: number; bend?: number;
}
function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type ?? 'sine';
  if (o.detune) osc.detune.setValueAtTime(o.detune, ctx.currentTime);
  const t0 = ctx.currentTime + (o.start ?? 0);
  const dur = o.dur ?? 0.25;
  const peak = o.peak ?? 0.08;
  const att = o.attack ?? 0.005;
  const rel = o.release ?? Math.max(0.04, dur - att);
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.bend) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.bend), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + att);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + att + rel);
  osc.connect(gain).connect(dest);
  osc.start(t0);
  osc.stop(t0 + att + rel + 0.02);
}

interface NoiseOpts {
  start?: number; dur?: number; peak?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number; sweepTo?: number };
}
function noise(ctx: AudioContext, dest: AudioNode, o: NoiseOpts) {
  const dur = o.dur ?? 0.2;
  const start = o.start ?? 0;
  const peak = o.peak ?? 0.06;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let last: AudioNode = src;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.freq, t0);
    if (o.filter.q != null) f.Q.setValueAtTime(o.filter.q, t0);
    if (o.filter.sweepTo) f.frequency.exponentialRampToValueAtTime(o.filter.sweepTo, t0 + dur);
    src.connect(f); last = f;
  }
  last.connect(gain).connect(dest);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

/* ─── Cue compositions ────────────────────────────────────────────── */

function playCue(cue: NxSfxCue) {
  const ctx = getCtx();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.85, ctx.currentTime);
  master.connect(ctx.destination);
  const out: AudioNode = master;

  switch (cue) {
    /* ── UI ── */
    case 'ui.tap':
      tone(ctx, out, { freq: 720, type: 'sine', dur: 0.05, peak: 0.04 });
      tone(ctx, out, { freq: 1080, type: 'sine', dur: 0.04, peak: 0.025, start: 0.005 });
      break;
    case 'place':
      // Mag-clamp lock: thunk + cyan confirmation chirp
      tone(ctx, out, { freq: 110, type: 'square', dur: 0.10, peak: 0.09, bend: 0.6 });
      tone(ctx, out, { freq: 880, type: 'sine', dur: 0.10, peak: 0.06, start: 0.04, bend: 1.4 });
      noise(ctx, out, { dur: 0.06, peak: 0.04, filter: { type: 'highpass', freq: 4000 } });
      break;
    case 'upgrade':
      // Power-up ramp: ascending triad
      tone(ctx, out, { freq: 523, type: 'sine', dur: 0.10, peak: 0.06 });
      tone(ctx, out, { freq: 784, type: 'sine', dur: 0.12, peak: 0.06, start: 0.07 });
      tone(ctx, out, { freq: 1175, type: 'triangle', dur: 0.16, peak: 0.06, start: 0.14, bend: 1.05 });
      noise(ctx, out, { dur: 0.18, peak: 0.025, filter: { type: 'bandpass', freq: 3000, sweepTo: 5500 } });
      break;
    case 'sell':
      // Disassemble: descending pair + soft hiss
      tone(ctx, out, { freq: 540, type: 'triangle', dur: 0.12, peak: 0.05, bend: 0.6 });
      tone(ctx, out, { freq: 360, type: 'sine', dur: 0.14, peak: 0.04, start: 0.08, bend: 0.6 });
      noise(ctx, out, { dur: 0.18, peak: 0.025, filter: { type: 'lowpass', freq: 1400 } });
      break;
    case 'invalid':
      tone(ctx, out, { freq: 200, type: 'square', dur: 0.14, peak: 0.06, bend: 0.55 });
      noise(ctx, out, { dur: 0.10, peak: 0.025, filter: { type: 'lowpass', freq: 800 } });
      break;

    /* ── Tower fire ── */
    case 'shot.pulse':
      // Clean plasma burst — short, sub-pop + bright zip
      tone(ctx, out, { freq: 880, type: 'sine', dur: 0.07, peak: 0.05, bend: 0.5 });
      tone(ctx, out, { freq: 220, type: 'square', dur: 0.05, peak: 0.05, bend: 0.6 });
      noise(ctx, out, { dur: 0.05, peak: 0.025, filter: { type: 'bandpass', freq: 3500 } });
      break;
    case 'shot.arc':
      // Electric snap — sawtooth zap + crackle
      tone(ctx, out, { freq: 320, type: 'sawtooth', dur: 0.08, peak: 0.05, bend: 4.5 });
      noise(ctx, out, { dur: 0.10, peak: 0.04, filter: { type: 'bandpass', freq: 4500, q: 2.5, sweepTo: 7500 } });
      break;
    case 'shot.cryo':
      // Frost discharge — soft icy puff with mid swell
      tone(ctx, out, { freq: 600, type: 'sine', dur: 0.14, peak: 0.04, bend: 0.7 });
      noise(ctx, out, { dur: 0.16, peak: 0.035, filter: { type: 'highpass', freq: 5000 } });
      break;
    case 'shot.rail':
      // Heavier kinetic shot — body thud + bright crack tail
      tone(ctx, out, { freq: 90, type: 'square', dur: 0.10, peak: 0.08, bend: 0.55 });
      tone(ctx, out, { freq: 1400, type: 'sawtooth', dur: 0.06, peak: 0.05, bend: 0.4 });
      noise(ctx, out, { dur: 0.08, peak: 0.04, filter: { type: 'highpass', freq: 4500 } });
      break;

    /* ── Combat ── */
    case 'enemy.hit':
      noise(ctx, out, { dur: 0.04, peak: 0.05, filter: { type: 'lowpass', freq: 500 } });
      tone(ctx, out, { freq: 240, type: 'square', dur: 0.06, peak: 0.05, bend: 0.55 });
      break;
    case 'enemy.die':
      // Energy collapse — quick crack + falling saw + lowpass dust
      noise(ctx, out, { dur: 0.04, peak: 0.06, filter: { type: 'highpass', freq: 4000 } });
      tone(ctx, out, { freq: 380, type: 'sawtooth', dur: 0.22, peak: 0.06, bend: 0.3, start: 0.01 });
      noise(ctx, out, { dur: 0.20, peak: 0.04, filter: { type: 'lowpass', freq: 1400, sweepTo: 220 }, start: 0.02 });
      break;
    case 'enemy.die.boss':
      // Bigger cascade for elites/bosses
      tone(ctx, out, { freq: 70, type: 'sawtooth', dur: 0.45, peak: 0.10, bend: 0.5 });
      noise(ctx, out, { dur: 0.06, peak: 0.08, filter: { type: 'highpass', freq: 3500 } });
      tone(ctx, out, { freq: 320, type: 'sawtooth', dur: 0.5, peak: 0.07, bend: 0.25, start: 0.04 });
      noise(ctx, out, { dur: 0.45, peak: 0.06, filter: { type: 'lowpass', freq: 1800, sweepTo: 200 }, start: 0.04 });
      tone(ctx, out, { freq: 1200, type: 'sine', dur: 0.18, peak: 0.05, start: 0.18, bend: 0.5 });
      break;
    case 'leak':
      // Breach klaxon: dual descending sawtooth + sub thump
      tone(ctx, out, { freq: 360, type: 'sawtooth', dur: 0.22, peak: 0.09, bend: 0.45 });
      tone(ctx, out, { freq: 300, type: 'sawtooth', dur: 0.22, peak: 0.07, bend: 0.45, detune: -10, start: 0.04 });
      tone(ctx, out, { freq: 70, type: 'sine', dur: 0.28, peak: 0.10, bend: 0.6, start: 0.02 });
      noise(ctx, out, { dur: 0.18, peak: 0.04, filter: { type: 'lowpass', freq: 1200 }, start: 0.06 });
      break;

    /* ── Abilities ── */
    case 'ability.ready':
      tone(ctx, out, { freq: 880, type: 'sine', dur: 0.12, peak: 0.05, bend: 1.5 });
      tone(ctx, out, { freq: 1320, type: 'sine', dur: 0.14, peak: 0.04, start: 0.06 });
      break;
    case 'ability.cast.orbital':
      // Targeting cue → impact blast
      tone(ctx, out, { freq: 1800, type: 'sine', dur: 0.16, peak: 0.05, bend: 0.4 });
      tone(ctx, out, { freq: 1800, type: 'sine', dur: 0.16, peak: 0.05, bend: 0.4, start: 0.10 });
      tone(ctx, out, { freq: 60, type: 'square', dur: 0.45, peak: 0.12, bend: 0.5, start: 0.30 });
      tone(ctx, out, { freq: 220, type: 'sawtooth', dur: 0.40, peak: 0.08, bend: 0.4, start: 0.30 });
      noise(ctx, out, { dur: 0.55, peak: 0.08, filter: { type: 'lowpass', freq: 1800, sweepTo: 200 }, start: 0.30 });
      noise(ctx, out, { dur: 0.20, peak: 0.06, filter: { type: 'highpass', freq: 4500 }, start: 0.30 });
      break;
    case 'ability.cast.emp':
      // Charge-up hum → electric suppression burst
      tone(ctx, out, { freq: 110, type: 'sawtooth', dur: 0.30, peak: 0.06, bend: 4.0 });
      tone(ctx, out, { freq: 220, type: 'square', dur: 0.30, peak: 0.05, bend: 4.0, detune: 12 });
      noise(ctx, out, { dur: 0.40, peak: 0.06, filter: { type: 'bandpass', freq: 800, q: 2.5, sweepTo: 6000 }, start: 0.10 });
      tone(ctx, out, { freq: 1600, type: 'sawtooth', dur: 0.10, peak: 0.05, bend: 0.5, start: 0.34 });
      break;

    /* ── Wave / outcome ── */
    case 'wave.start':
      // Tactical pulse: rising sub + tactical ping
      tone(ctx, out, { freq: 220, type: 'sine', dur: 0.30, peak: 0.07, bend: 1.6 });
      tone(ctx, out, { freq: 1320, type: 'sine', dur: 0.18, peak: 0.05, start: 0.10 });
      noise(ctx, out, { dur: 0.30, peak: 0.025, filter: { type: 'bandpass', freq: 2200, sweepTo: 4500 } });
      break;
    case 'wave.clear': {
      // Success sweep: triad + airy whoosh
      const notes = [523, 784, 1175];
      notes.forEach((n, i) => tone(ctx, out, { freq: n, type: 'sine', dur: 0.18, peak: 0.06, start: i * 0.06 }));
      noise(ctx, out, { dur: 0.30, peak: 0.03, filter: { type: 'bandpass', freq: 2400, sweepTo: 5500 } });
      break;
    }
    case 'victory': {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((n, i) => tone(ctx, out, { freq: n, type: 'sine', dur: 0.22, peak: 0.07, start: i * 0.08 }));
      tone(ctx, out, { freq: 1568, type: 'triangle', dur: 0.45, peak: 0.06, start: 0.42, bend: 1.05 });
      noise(ctx, out, { dur: 0.50, peak: 0.025, filter: { type: 'bandpass', freq: 3000, sweepTo: 6000 }, start: 0.20 });
      break;
    }
    case 'defeat':
      tone(ctx, out, { freq: 280, type: 'sawtooth', dur: 0.40, peak: 0.09, bend: 0.45 });
      tone(ctx, out, { freq: 200, type: 'sawtooth', dur: 0.50, peak: 0.08, bend: 0.5, start: 0.12, detune: -12 });
      tone(ctx, out, { freq: 70, type: 'sine', dur: 0.55, peak: 0.10, bend: 0.5, start: 0.05 });
      noise(ctx, out, { dur: 0.55, peak: 0.04, filter: { type: 'lowpass', freq: 800, sweepTo: 200 }, start: 0.10 });
      break;
  }
}

const HAPTICS: Partial<Record<NxSfxCue, number | number[]>> = {
  place: 12,
  upgrade: [8, 14, 14],
  sell: 6,
  invalid: [10, 30, 10],
  'enemy.die.boss': [12, 20, 18],
  leak: [25, 40, 25],
  'ability.cast.orbital': [10, 30, 35],
  'ability.cast.emp': [18, 22, 18],
  'wave.start': 14,
  'wave.clear': [10, 20, 10],
  victory: [12, 18, 12, 18, 30],
  defeat: [40, 80, 40],
  'ability.ready': 6,
};

function maybeHaptic(cue: NxSfxCue) {
  const s = getSoundSettings();
  if (!(s.master && s.haptics)) return;
  if (!('vibrate' in navigator)) return;
  const pattern = HAPTICS[cue];
  if (pattern == null) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

/* ─── Throttle helpers ────────────────────────────────────────────── */

const SHOT_MIN_MS_PER_TYPE = 70;   // avoid stacking dozens of shots per second
const HIT_MIN_MS = 60;             // hits are common during waves
const KILL_MIN_MS = 80;

export function useNexusSfx() {
  const lastShotAtRef = useRef<Record<TowerKind, number>>(
    Object.fromEntries(TOWER_KINDS.map((k) => [k, 0])) as Record<TowerKind, number>,
  );
  const lastHitAtRef = useRef(0);
  const lastKillAtRef = useRef(0);
  const lastEventTimeRef = useRef(0);

  const play = useCallback((cue: NxSfxCue) => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      // still allow haptics (subtle), but skip heavy audio for safety
    }
    const s = getSoundSettings();
    const cat = categoryFor(cue);
    if (s.master && s.categories[cat]) {
      try { playCue(cue); } catch { /* ignore */ }
    }
    maybeHaptic(cue);
  }, []);

  /** Walk new BattleEvents and emit appropriate cues + haptics. */
  const consumeEvents = useCallback((events: BattleEvent[]) => {
    if (!events?.length) return;
    const now = performance.now();
    for (const ev of events) {
      // Only react to events newer than the last event timestamp we've seen.
      if (ev.t <= lastEventTimeRef.current) continue;
      switch (ev.type) {
        case 'shot': {
          const last = lastShotAtRef.current[ev.tower] ?? 0;
          if (now - last < SHOT_MIN_MS_PER_TYPE) break;
          lastShotAtRef.current[ev.tower] = now;
          play(`shot.${ev.tower}` as NxSfxCue);
          break;
        }
        case 'kill': {
          if (now - lastKillAtRef.current < KILL_MIN_MS) break;
          lastKillAtRef.current = now;
          play('enemy.die');
          break;
        }
        case 'leak':
          play('leak');
          break;
        case 'ability':
          play(`ability.cast.${ev.ability}` as NxSfxCue);
          break;
      }
    }
    // Track the highest event timestamp so we never replay across re-renders.
    const maxT = events.reduce((m, e) => (e.t > m ? e.t : m), lastEventTimeRef.current);
    lastEventTimeRef.current = maxT;
  }, [play]);

  /** Manually mark a hit (used when we want hit-feedback without engine event). */
  const hit = useCallback(() => {
    const now = performance.now();
    if (now - lastHitAtRef.current < HIT_MIN_MS) return;
    lastHitAtRef.current = now;
    play('enemy.hit');
  }, [play]);

  // Reset throttles when the hook unmounts (e.g. mission swap).
  useEffect(() => () => {
    lastEventTimeRef.current = 0;
  }, []);

  return { play, consumeEvents, hit };
}
