// Rune Delve — Chamber Backdrop (V5 visual overhaul)
//
// Per-chamber atmospheric wash that sits BEHIND every play-page
// element. Each of the 10 chamber layouts declares an `atmosphere`
// keyword (torchlit / mossy / crystalline / embered / cursed /
// sealed / abyssal) and an `accent` HSL — this component reads
// those and paints the right mood:
//
//   torchlit    — warm amber radial, ember warmth (Ancient Gate)
//   mossy       — cool damp green-cyan flow      (Split Passage)
//   crystalline — sharp cyan-violet refraction    (Crystal Archive)
//   embered     — pulsing red-orange warmth       (Ember Hollow)
//   cursed      — heavy purple-red abyssal pull   (Cursed Vault)
//   sealed      — gold-red ritual chamber         (Final Seal Chamber)
//   abyssal     — deep void purple-black          (Shadow Reliquary)
//
// Implementation: pure CSS gradients. Two layered radial gradients
// per atmosphere create depth (a bright center + a darker rim) plus
// a top-bottom vignette for "ceiling shadow" feel.
//
// Mounted once per play page render, fixed-positioned at z-index -1
// so all gameplay UI sits on top. No interactivity, no animations
// (so prefers-reduced-motion is automatically respected).

import { useMemo } from 'react';
import type { RuneLayout } from '@/lib/runedelve/runeLayouts';

interface Props {
  layout: RuneLayout | undefined | null;
}

type Atmosphere = RuneLayout['preview']['atmosphere'];

interface AtmoSpec {
  /** Center color — HSL triple. Forms the radial gradient's heart. */
  centerHsl: string;
  /** Rim color — HSL triple. The outer color the radial fades to. */
  rimHsl: string;
  /** How "bright" the center is. 0.18 default; embered/torchlit
   *  push higher because they're meant to feel lit. */
  centerOpacity: number;
}

const ATMO: Record<Atmosphere, AtmoSpec> = {
  torchlit:    { centerHsl: '38 95% 55%',  rimHsl: '20 60% 8%',  centerOpacity: 0.28 },
  mossy:       { centerHsl: '152 55% 35%', rimHsl: '180 45% 8%', centerOpacity: 0.20 },
  crystalline: { centerHsl: '195 90% 55%', rimHsl: '255 50% 10%', centerOpacity: 0.22 },
  embered:     { centerHsl: '15 95% 55%',  rimHsl: '0 55% 8%',   centerOpacity: 0.32 },
  cursed:      { centerHsl: '300 55% 35%', rimHsl: '340 60% 6%', centerOpacity: 0.24 },
  sealed:      { centerHsl: '0 75% 45%',   rimHsl: '38 80% 8%',  centerOpacity: 0.30 },
  abyssal:     { centerHsl: '270 60% 25%', rimHsl: '260 60% 4%', centerOpacity: 0.20 },
};

export function ChamberBackdrop({ layout }: Props) {
  // Compute background string from the layout's atmosphere + accent.
  // Memoized so successive renders with the same layout don't rebuild
  // the gradient string (cheap, but it makes intent clear).
  const background = useMemo(() => {
    if (!layout) return undefined;
    const spec = ATMO[layout.preview.atmosphere];
    // Three layers, painted back-to-front:
    //   1. Outer rim — soft tint of the rim color across the bottom
    //      half, gives a "ground" feel
    //   2. Center radial — the chamber's lit heart, using the
    //      atmosphere's center hue
    //   3. Top vignette — darker hood across the top quarter to
    //      simulate a ceiling shadow that pulls the eye toward
    //      the board
    return [
      // 1. Bottom rim wash
      `linear-gradient(180deg, transparent 40%, hsl(${spec.rimHsl} / 0.55) 100%)`,
      // 2. Center radial — the chamber's lit heart
      `radial-gradient(ellipse 60% 45% at 50% 42%, hsl(${spec.centerHsl} / ${spec.centerOpacity}), transparent 70%)`,
      // 3. Top vignette
      `linear-gradient(180deg, hsl(${spec.rimHsl} / 0.4) 0%, transparent 25%)`,
    ].join(', ');
  }, [layout]);

  if (!layout) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: -1,
        background,
      }}
    />
  );
}
