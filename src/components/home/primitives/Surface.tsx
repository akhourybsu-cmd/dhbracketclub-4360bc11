// DH Club Home — Surface primitive
//
// Central recipe for the home shell. Stops every block from being a
// bordered `rounded-2xl bg-card` lookalike by giving us four explicit
// surface variants, used everywhere on Home:
//
//   • hero    — cinematic gradient-washed slab. Reserved for ONE block
//               per screen (the primary next-action). Earns the glow.
//   • pulse   — open container that holds flowing rows separated by
//               hair-line dividers, not per-row borders.
//   • ambient — borderless, low-contrast grouping. Section headers +
//               content sit on the page itself.
//   • tile    — bordered interactive tile (app dock tiles, quick actions).
//
// Variants use design tokens only — no hardcoded colors. Light & dark
// parity is automatic because every surface routes through hsl(var(--…)).

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SurfaceVariant = 'hero' | 'pulse' | 'ambient' | 'tile';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  /** HSL components for an accent color (e.g. "152 72% 46%"). Hero applies it
   *  as a radial wash + soft outline glow. Other variants ignore it. */
  accent?: string;
  children?: ReactNode;
}

export const Surface = forwardRef<HTMLDivElement, Props>(function Surface(
  { variant = 'ambient', accent, className, style, children, ...rest },
  ref,
) {
  const base = 'relative';
  const variantClass =
    variant === 'hero'    ? 'rounded-[22px] overflow-hidden' :
    variant === 'pulse'   ? 'rounded-2xl overflow-hidden' :
    variant === 'tile'    ? 'rounded-2xl border border-border/40 bg-card overflow-hidden' :
                            ''; // ambient — no chrome

  let variantStyle: React.CSSProperties = {};
  if (variant === 'hero' && accent) {
    variantStyle = {
      background:
        `radial-gradient(130% 90% at 0% 0%, hsl(${accent} / 0.22), transparent 60%),` +
        `radial-gradient(120% 90% at 100% 100%, hsl(${accent} / 0.10), transparent 65%),` +
        `linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)`,
      boxShadow: `0 1px 0 hsl(var(--foreground) / 0.04) inset, 0 18px 40px -22px hsl(${accent} / 0.55)`,
    };
  } else if (variant === 'hero') {
    variantStyle = {
      background:
        `radial-gradient(130% 90% at 0% 0%, hsl(var(--primary) / 0.18), transparent 60%),` +
        `linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)`,
    };
  } else if (variant === 'pulse') {
    variantStyle = {
      background: 'linear-gradient(180deg, hsl(var(--card) / 0.6), hsl(var(--card) / 0.35))',
    };
  }

  return (
    <div
      ref={ref}
      className={cn(base, variantClass, className)}
      style={{ ...variantStyle, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
});
