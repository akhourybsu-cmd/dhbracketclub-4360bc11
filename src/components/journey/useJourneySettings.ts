// Player settings for The Splendid Journey (local to the device).
// Reading comfort and motion first; audio fields exist as a foundation only.

import { useCallback, useEffect, useState } from 'react';

export type JourneyTextSize = 'sm' | 'md' | 'lg' | 'xl';

export interface JourneySettings {
  textSize: JourneyTextSize;
  reducedMotion: boolean;
  music: boolean;
  soundEffects: boolean;
  ambientAudio: boolean;
  dialogueAnimation: boolean;
}

const KEY = 'jy_settings_v1';

const DEFAULTS: JourneySettings = {
  textSize: 'md',
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
