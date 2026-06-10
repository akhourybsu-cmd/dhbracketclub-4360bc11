import { useEffect, useRef } from 'react';

interface Props {
  /** Increment to trigger a hurt flash (red, hurt-vignette). */
  hurtKey: number;
  /** Increment to trigger a heal glow (green, softer). */
  healKey?: number;
  /** V1 — Increment to trigger a heavy-strike flash (gold, brighter).
   *  Fires on chain ≥ 6 so the existing heavy-strike threshold gets
   *  a signature on-screen presence beyond cam shake. */
  heavyKey?: number;
}

/**
 * Full-screen vignette pulse, mounted once inside the play page. Other
 * components fire flashes by bumping a counter in state; the effect
 * reapplies the CSS animation class for a clean replay.
 */
export function ScreenEdgeFlash({ hurtKey, healKey = 0, heavyKey = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const firstHurt = useRef(true);
  const firstHeal = useRef(true);
  const firstHeavy = useRef(true);

  useEffect(() => {
    if (firstHurt.current) { firstHurt.current = false; return; }
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-on', 'is-heal', 'is-heavy');
    void el.offsetWidth;
    el.classList.add('is-on');
    const t = window.setTimeout(() => el.classList.remove('is-on'), 380);
    return () => window.clearTimeout(t);
  }, [hurtKey]);

  useEffect(() => {
    if (firstHeal.current) { firstHeal.current = false; return; }
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-on', 'is-heal', 'is-heavy');
    void el.offsetWidth;
    el.classList.add('is-on', 'is-heal');
    const t = window.setTimeout(() => el.classList.remove('is-on', 'is-heal'), 380);
    return () => window.clearTimeout(t);
  }, [healKey]);

  useEffect(() => {
    if (firstHeavy.current) { firstHeavy.current = false; return; }
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-on', 'is-heal', 'is-heavy');
    void el.offsetWidth;
    el.classList.add('is-on', 'is-heavy');
    const t = window.setTimeout(() => el.classList.remove('is-on', 'is-heavy'), 400);
    return () => window.clearTimeout(t);
  }, [heavyKey]);

  return <div ref={ref} aria-hidden className="rd-screen-flash" />;
}
