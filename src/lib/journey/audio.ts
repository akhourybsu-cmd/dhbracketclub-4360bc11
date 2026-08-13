// The Splendid Journey — synthesized audio.
//
// No audio files are shipped. Everything here is generated with the Web Audio
// API: a mellow, slowly-evolving ambient pad (the "fantasy track") and a soft
// harp-like flourish for selections. This keeps the whole thing self-contained,
// offline-friendly, and tiny. All of it respects the reader's Music / Sound-
// effects settings and the browser rule that audio may only start after a user
// gesture (call `unlockAudio()` from a real interaction).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicOn = false;
let sfxOn = true;

// Ambient lifecycle
let ambient: { stop: () => void } | null = null;
// Keep the pad alive across in-journey navigation: only tear down once every
// journey surface has unmounted.
let mountCount = 0;
let leaveTimer: number | undefined;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Call from a genuine user gesture so the browser permits audio. */
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  if (musicOn && !ambient) startAmbient();
}

export function setMusicEnabled(on: boolean) {
  musicOn = on;
  if (on) {
    if (ctx && ctx.state === 'running') startAmbient();
  } else {
    stopAmbient();
  }
}

export function setSfxEnabled(on: boolean) { sfxOn = on; }

export function journeyEnter() {
  mountCount += 1;
  if (leaveTimer) { window.clearTimeout(leaveTimer); leaveTimer = undefined; }
}

export function journeyLeave() {
  mountCount = Math.max(0, mountCount - 1);
  if (leaveTimer) window.clearTimeout(leaveTimer);
  // A short grace period so navigating between journey screens doesn't cut the
  // pad; only stop once the player has truly left the journey.
  leaveTimer = window.setTimeout(() => { if (mountCount === 0) stopAmbient(); }, 400);
}

// ── The ambient pad ─────────────────────────────────────────────────────────
function startAmbient() {
  const c = ensureCtx();
  if (!c || !master || ambient) return;

  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(master);

  // Warm the whole bed and take the edge off.
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  lp.Q.value = 0.5;
  lp.connect(bus);

  // A little space, without a reverb impulse.
  const delay = c.createDelay(1.0);
  delay.delayTime.value = 0.34;
  const fb = c.createGain();
  fb.gain.value = 0.28;
  lp.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(bus);

  // Two related, low, modal chords the pad drifts between.
  const chords = [
    [146.83, 220.0, 293.66, 440.0], // D minor-ish
    [130.81, 196.0, 261.63, 392.0], // C major-ish
  ];
  const voices = chords[0].map((f) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.22;
    o.connect(g);
    g.connect(lp);
    o.start();
    return o;
  });

  // Slow "breathing" on the whole bed.
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.05;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain);
  lfoGain.connect(bus.gain);
  lfo.start();

  bus.gain.setValueAtTime(0, c.currentTime);
  bus.gain.linearRampToValueAtTime(0.11, c.currentTime + 5);

  const applyChord = (chord: number[]) => {
    if (!ctx) return;
    voices.forEach((o, i) => {
      const detune = 1 + (Math.random() - 0.5) * 0.004;
      o.frequency.linearRampToValueAtTime(chord[i] * detune, ctx.currentTime + 7);
    });
  };
  let idx = 0;
  applyChord(chords[0]);
  const interval = window.setInterval(() => {
    idx = (idx + 1) % chords.length;
    applyChord(chords[idx]);
  }, 16000);

  ambient = {
    stop() {
      window.clearInterval(interval);
      if (!ctx) return;
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 1.6);
      voices.forEach((o) => { try { o.stop(t + 1.8); } catch { /* already stopped */ } });
      try { lfo.stop(t + 1.8); } catch { /* already stopped */ }
    },
  };
}

function stopAmbient() {
  if (ambient) { ambient.stop(); ambient = null; }
}

// ── Selection flourish ──────────────────────────────────────────────────────
/** A soft ascending harp-like arpeggio for choosing something meaningful. */
export function playSelect() {
  if (!sfxOn) return;
  const c = ensureCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime;
  const notes = [587.33, 880.0, 1174.66]; // D5 · A5 · D6
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    const start = t + i * 0.05;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.11, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0006, start + 0.5);
    o.connect(g);
    g.connect(master!);
    o.start(start);
    o.stop(start + 0.55);
  });
}

/** A single soft note for secondary taps (nav, back, toggles). */
export function playSoft() {
  if (!sfxOn) return;
  const c = ensureCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.value = 523.25; // C5
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.28);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.32);
}
