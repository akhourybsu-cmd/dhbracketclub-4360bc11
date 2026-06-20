// DH Club Home — DH Shield SVG (Club Pulse hero artwork)
//
// Heraldic shield with a soft neon-green glow + the club's monogram
// glyph (DH) inscribed. Renders as inline SVG so it scales cleanly
// and never produces a broken-image reference. Used as the
// decorative right-side artwork on the ClubPulseCard.
//
// Accent color comes from the club's accent_color HSL triple so the
// shield matches whichever club the user is in.

interface Props {
  /** HSL triple for the primary accent, e.g. `'152 72% 46%'`. */
  accent: string;
  /** Optional club monogram override (1–2 chars). Defaults to "DH". */
  monogram?: string;
  className?: string;
}

export function DhShield({ accent, monogram = 'DH', className }: Props) {
  // Two-letter monograms scale at 0.65 of viewport height; single
  // letters get the full 0.8 so they don't look tiny.
  const fontSize = monogram.length >= 2 ? 64 : 84;

  return (
    <svg
      viewBox="0 0 180 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Outer glow — radial gradient for atmospheric green halo */}
        <radialGradient id="dh-shield-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={`hsl(${accent} / 0.45)`} />
          <stop offset="50%" stopColor={`hsl(${accent} / 0.15)`} />
          <stop offset="100%" stopColor={`hsl(${accent} / 0)`} />
        </radialGradient>
        {/* Shield body gradient — top-light to bottom-dark */}
        <linearGradient id="dh-shield-body" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${accent} / 0.22)`} />
          <stop offset="60%" stopColor={`hsl(${accent} / 0.08)`} />
          <stop offset="100%" stopColor={`hsl(${accent} / 0.04)`} />
        </linearGradient>
        {/* Inner rim highlight */}
        <linearGradient id="dh-shield-rim" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${accent} / 0.85)`} />
          <stop offset="100%" stopColor={`hsl(${accent} / 0.35)`} />
        </linearGradient>
        {/* Drop shadow filter for the shield body */}
        <filter id="dh-shield-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
          <feOffset dx="0" dy="2" />
          <feComponentTransfer><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Outer atmospheric glow */}
      <ellipse cx="90" cy="100" rx="90" ry="100" fill="url(#dh-shield-glow)" />

      {/* Shield outline path — classic heraldic shape */}
      <path
        d="M 90 20
           L 160 30
           L 160 100
           Q 160 145, 90 180
           Q 20 145, 20 100
           L 20 30 Z"
        fill="url(#dh-shield-body)"
        stroke="url(#dh-shield-rim)"
        strokeWidth="2"
        filter="url(#dh-shield-shadow)"
      />

      {/* Inner thin highlight outline */}
      <path
        d="M 90 28
           L 152 36
           L 152 100
           Q 152 138, 90 170
           Q 28 138, 28 100
           L 28 36 Z"
        fill="none"
        stroke={`hsl(${accent} / 0.45)`}
        strokeWidth="1"
      />

      {/* Monogram — Cinzel-style display feel */}
      <text
        x="90"
        y="118"
        textAnchor="middle"
        fontFamily="Cinzel, Plus Jakarta Sans, serif"
        fontSize={fontSize}
        fontWeight="800"
        letterSpacing="2"
        fill={`hsl(${accent})`}
        style={{
          filter: `drop-shadow(0 0 12px hsl(${accent} / 0.6))`,
        }}
      >
        {monogram}
      </text>
    </svg>
  );
}
