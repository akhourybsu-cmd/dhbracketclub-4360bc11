// THE SPLENDID JOURNEY — procedural scene atmosphere.
//
// Campaign packages reference a `background_asset` string (e.g. "ashfen_marsh"
// or "throne_hall"). Rather than requiring authors to ship artwork for every
// scene, we derive a hand-tuned colour atmosphere from that key: two glow
// layers plus a horizon wash, all in the aged-ink / charcoal / forest / brass
// family. Real artwork, when it exists, layers on top of this backdrop.

export interface Atmosphere {
  /** CSS background for the fixed backdrop layer. */
  background: string;
  /** Accent hue (HSL triplet) used for rules and focal glows. */
  accent: string;
  /** Human label used only for debugging / studio previews. */
  name: string;
}

const PALETTES: Record<string, { a: string; b: string; accent: string; name: string }> = {
  wild:    { a: '150 24% 16%', b: '120 18% 8%',  accent: '150 26% 46%', name: 'Wildland' },
  marsh:   { a: '168 20% 14%', b: '190 16% 7%',  accent: '168 22% 44%', name: 'Marsh' },
  hall:    { a: '36 26% 18%',  b: '28 16% 7%',   accent: '38 48% 58%',  name: 'Hall' },
  ruin:    { a: '24 14% 16%',  b: '20 12% 6%',   accent: '30 24% 48%',  name: 'Ruin' },
  night:   { a: '214 26% 16%', b: '220 22% 6%',  accent: '214 28% 56%', name: 'Night' },
  ember:   { a: '18 34% 18%',  b: '10 22% 7%',   accent: '20 46% 52%',  name: 'Ember' },
  blood:   { a: '355 28% 17%', b: '350 20% 6%',  accent: '355 42% 52%', name: 'Blood' },
  arcane:  { a: '206 24% 17%', b: '212 20% 7%',  accent: '206 30% 58%', name: 'Arcane' },
  road:    { a: '40 16% 16%',  b: '32 14% 7%',   accent: '40 30% 52%',  name: 'Road' },
};

const KEYWORDS: Array<[RegExp, keyof typeof PALETTES]> = [
  [/marsh|fen|swamp|bog|mire|water|river|coast|sea/, 'marsh'],
  [/forest|wood|grove|glade|wild|moor|field|meadow/, 'wild'],
  [/hall|throne|court|keep|manor|temple|library|market|inn|tavern/, 'hall'],
  [/ruin|crypt|tomb|cave|deep|catacomb|mine|vault/, 'ruin'],
  [/night|star|moon|dream|sky|storm/, 'night'],
  [/fire|forge|ember|ash|kiln|hearth/, 'ember'],
  [/battle|war|blood|siege|duel|arena/, 'blood'],
  [/arcane|rune|magic|spirit|sanctum|shrine|omen/, 'arcane'],
  [/road|path|journey|travel|gate|bridge|camp/, 'road'],
];

const SCENE_TYPE_FALLBACK: Record<string, keyof typeof PALETTES> = {
  combat: 'blood',
  dialogue: 'hall',
  exploration: 'wild',
  discovery: 'arcane',
  ending: 'ember',
  transition: 'road',
};

/** Resolve the atmosphere for a scene from its asset key and type. */
export function sceneAtmosphere(
  backgroundAsset?: string | null,
  sceneType?: string | null,
): Atmosphere {
  const key = (backgroundAsset ?? '').toLowerCase();
  let pick: keyof typeof PALETTES | undefined;
  for (const [re, name] of KEYWORDS) {
    if (re.test(key)) { pick = name; break; }
  }
  if (!pick && sceneType) pick = SCENE_TYPE_FALLBACK[sceneType.toLowerCase()];
  const p = PALETTES[pick ?? 'road'];

  return {
    name: p.name,
    accent: p.accent,
    background: [
      `radial-gradient(120% 70% at 50% -8%, hsl(${p.a} / 0.75), transparent 62%)`,
      `radial-gradient(90% 55% at 12% 108%, hsl(${p.b} / 0.9), transparent 66%)`,
      `radial-gradient(70% 45% at 88% 96%, hsl(${p.accent} / 0.10), transparent 70%)`,
      `linear-gradient(180deg, hsl(28 12% 7%), hsl(28 14% 4%))`,
    ].join(', '),
  };
}

/**
 * Deterministic portrait hue for a speaker. The same character keeps the same
 * colour for the whole campaign without any authored art, which is what makes
 * multi-voice dialogue readable at a glance.
 */
export function speakerHue(speaker: string): number {
  let h = 0;
  for (let i = 0; i < speaker.length; i++) h = (h * 31 + speaker.charCodeAt(i)) % 360;
  // Bias away from neon: keep to earthy / brass / forest / slate bands.
  const bands = [26, 38, 46, 96, 150, 186, 208, 348];
  return bands[h % bands.length];
}

/** Initials for a portrait medallion (max two glyphs). */
export function speakerInitials(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Split dialogue or narration into reveal units without breaking prose. */
export function splitLines(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?…"'”’])\s+(?=[A-Z"'“‘])/)
    .map((s) => s.trim())
    .filter(Boolean);
}
