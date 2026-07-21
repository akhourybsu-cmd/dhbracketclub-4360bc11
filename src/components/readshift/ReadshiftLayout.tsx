import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { VenetianMask, X } from 'lucide-react';

/**
 * Full-screen standalone shell for READSHIFT. Applies the `.rs-mode` skin
 * (violet masquerade-noir palette) to the whole viewport, mounts a slim
 * persistent brand HUD, and floats a few decorative motes.
 *
 * AppLayout hides the DH Club mobile header + bottom nav while any
 * /readshift/* route is active, so this shell owns the full viewport —
 * exactly how Draft Arena, Nexus, Rune Delve, and Pick'em work.
 */
export function ReadshiftLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="rs-mode rs-shell relative min-h-[100dvh]">
      {/* Decorative drifting motes (masquerade confetti) */}
      <span aria-hidden className="rs-mote" style={{ top: '18%', left: '12%' }} />
      <span aria-hidden className="rs-mote rs-mote-2" style={{ top: '30%', right: '14%' }} />
      <span aria-hidden className="rs-mote rs-mote-3" style={{ top: '62%', left: '22%' }} />

      {/* Persistent brand HUD */}
      <header
        className="rs-hud sticky top-0 z-40 flex items-center gap-2.5 h-14 px-3.5"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="rs-page-icon !w-9 !h-9 !rounded-xl">
          <VenetianMask className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rs-wordmark text-[15px] leading-none">READSHIFT</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60 mt-1">
            Read the room · Shift your voice
          </div>
        </div>
        <button
          onClick={() => navigate('/compete')}
          className="rs-back"
          aria-label="Leave READSHIFT"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <main
        className="relative z-10 max-w-[560px] mx-auto px-3.5 pt-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>
    </div>
  );
}
