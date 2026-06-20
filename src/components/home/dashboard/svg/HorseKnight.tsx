// DH Club Home — Horse Knight SVG (Featured Draft Arena artwork)
//
// Chess-knight silhouette in a metallic dark-green palette with neon
// accent glow. Used as the decorative right-side artwork on the
// FeaturedSeasonCard to evoke "the draft is your strategic battle".
//
// Pure inline SVG — no asset files needed, never produces broken
// image refs. Path was hand-tuned to read as a stylised chess-knight
// piece at small + large sizes.

interface Props {
  /** HSL triple for the accent (typically club accent or gold). */
  accent: string;
  className?: string;
}

export function HorseKnight({ accent, className }: Props) {
  return (
    <svg
      viewBox="0 0 200 240"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Atmospheric green glow ring behind the piece */}
        <radialGradient id="hk-glow" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor={`hsl(${accent} / 0.55)`} />
          <stop offset="55%" stopColor={`hsl(${accent} / 0.18)`} />
          <stop offset="100%" stopColor={`hsl(${accent} / 0)`} />
        </radialGradient>
        {/* Body fill: dark green-to-black gradient that catches the rim light */}
        <linearGradient id="hk-body" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${accent} / 0.85)`} />
          <stop offset="35%" stopColor={`hsl(${accent} / 0.45)`} />
          <stop offset="75%" stopColor="hsl(0 0% 5%)" />
          <stop offset="100%" stopColor="hsl(0 0% 3%)" />
        </linearGradient>
        {/* Bevelled rim outline */}
        <linearGradient id="hk-rim" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${accent})`} />
          <stop offset="100%" stopColor={`hsl(${accent} / 0.4)`} />
        </linearGradient>
        {/* Pedestal base gradient */}
        <linearGradient id="hk-base" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${accent} / 0.6)`} />
          <stop offset="100%" stopColor="hsl(0 0% 6%)" />
        </linearGradient>
      </defs>

      {/* Atmospheric glow */}
      <ellipse cx="100" cy="130" rx="92" ry="100" fill="url(#hk-glow)" />

      {/* Knight body — stylised horse-head silhouette
          Shape walks: start at top of head, sweep around mane, down
          the neck, into the chunky chest, and back up the front. */}
      <path
        d="M 100 30
           Q 78 30, 70 50
           Q 60 65, 65 80
           L 55 88
           Q 52 92, 56 95
           L 70 92
           Q 75 105, 70 120
           L 55 140
           L 50 175
           L 60 178
           L 70 165
           L 85 155
           Q 100 152, 115 158
           L 130 168
           L 140 175
           L 150 175
           L 148 145
           Q 145 120, 138 100
           Q 145 80, 140 65
           Q 130 38, 100 30 Z"
        fill="url(#hk-body)"
        stroke="url(#hk-rim)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Eye highlight — small green-glow dot */}
      <circle cx="86" cy="68" r="3" fill={`hsl(${accent})`} opacity="0.9" />
      <circle cx="86" cy="68" r="1.4" fill="hsl(0 0% 100% / 0.8)" />

      {/* Mane crest highlight — thin lit ridge from forelock down */}
      <path
        d="M 95 38 Q 110 50, 118 75 Q 122 92, 116 110"
        fill="none"
        stroke={`hsl(${accent} / 0.75)`}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Pedestal base */}
      <ellipse cx="100" cy="200" rx="62" ry="8" fill="url(#hk-base)" opacity="0.9" />
      <rect x="42" y="195" width="116" height="14" rx="2"
        fill={`hsl(${accent} / 0.18)`}
        stroke={`hsl(${accent} / 0.5)`}
        strokeWidth="1.5" />
      <line x1="50" y1="202" x2="150" y2="202"
        stroke={`hsl(${accent} / 0.7)`} strokeWidth="1" />
    </svg>
  );
}
