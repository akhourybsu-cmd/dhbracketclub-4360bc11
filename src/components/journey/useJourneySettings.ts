// Player settings for The Splendid Journey (local to the device).
// Reading comfort and motion first; audio fields exist as a foundation only.

import { useCallback, useEffect, useState } from 'react';

export type JourneyTextSize = 'sm' | 'md' | 'lg' | 'xl';
export type JourneyTextSpeed = 'slow' | 'normal' | 'fast' | 'instant';

/** How fast narrated text is spoken onto the page. `chunk` characters are
 *  revealed every `stepMs`; `instant` shows the whole passage at once. Tuned
 *  so Normal reads like an unhurried storyteller (~55 cps), Fast keeps pace
 *  with a quick reader (~165 cps), and Slow lingers (~33 cps). */
export const TEXT_SPEEDS: Record<JourneyTextSpeed, { stepMs: number; chunk: number; label: string }> = {
  slow:    { stepMs: 30, chunk: 1, label: 'Slow' },
  normal:  { stepMs: 18, chunk: 1, label: 'Normal' },
  fast:    { stepMs: 12, chunk: 2, label: 'Fast' },
  instant: { stepMs: 0,  chunk: 0, label: 'Instant' },
};

export interface JourneySettings {
  textSize: JourneyTextSize;
  textSpeed: JourneyTextSpeed;
  reducedMotion: boolean;
  music: boolean;
  soundEffects: boolean;
  ambientAudio: boolean;
  dialogueAnimation: boolean;
}

const KEY = 'jy_settings_v1';

const DEFAULTS: JourneySettings = {
  textSize: 'md',
  textSpeed: 'normal',
  reducedMotion: false,
  music: false,
  soundEffects: true,
  ambientAudio: false,
  dialogueAnimation: true,
};

function read(): JourneySettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useJourneySettings() {
  const [settings, setSettings] = useState<JourneySettings>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setSettings(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback(<K extends keyof JourneySettings>(key: K, value: JourneySettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { ...settings, settings, update };
}
