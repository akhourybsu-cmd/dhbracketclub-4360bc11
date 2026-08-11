import { ReactNode } from 'react';
import { ForgeHUD } from './ForgeHUD';
import { ForgeBoot } from './ForgeBoot';

/**
 * Standalone shell for FORGE. Applies the `.fg-mode` ember skin to the
 * viewport, mounts the in-game HUD + one-time boot, and scatters a few
 * decorative embers. AppLayout hides the DH nav while /workouts/* is active,
 * so this shell owns the viewport — exactly how Draft Arena works.
 */
export function ForgeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fg-mode fg-shell relative min-h-[100dvh]">
      <ForgeHUD />

      {/* Decorative rising embers */}
      <span aria-hidden className="fg-ember" style={{ left: '12%', bottom: '18%' }} />
      <span aria-hidden className="fg-ember fg-ember-2" style={{ left: '78%', bottom: '30%' }} />
      <span aria-hidden className="fg-ember fg-ember-3" style={{ left: '46%', bottom: '10%' }} />

      <main
        className="relative z-[2] max-w-[640px] lg:max-w-[1100px] mx-auto px-3 sm:px-5 pt-3"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      <ForgeBoot />
    </div>
  );
}
