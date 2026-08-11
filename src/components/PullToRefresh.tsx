import { ReactNode, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const THRESHOLD = 72;   // pull distance that triggers a refresh
const MAX = 110;        // clamp so the content can't be dragged too far
const RESIST = 0.5;     // rubber-band resistance on the pull

/**
 * Touch pull-to-refresh for window-scrolled pages. Only engages when the
 * page is scrolled to the very top and the user drags down; shows a spinner
 * that follows the pull and rotates toward the trigger threshold. Touch-only,
 * so desktop (mouse) is unaffected. Wrap the page content and pass onRefresh.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false); // true = animate back with a transition

  // Refs mirror state so the touch handlers read latest values without the
  // effect re-subscribing on every pull frame.
  const startY = useRef<number | null>(null);
  const activeRef = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  const setPullBoth = (v: number) => { pullRef.current = v; setPull(v); };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1 || !atTop()) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      activeRef.current = false;
      setSettling(false);
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current == null || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || !atTop()) {
        if (activeRef.current) { activeRef.current = false; setSettling(true); setPullBoth(0); }
        return;
      }
      activeRef.current = true;
      setPullBoth(Math.min(MAX, dy * RESIST));
      // Suppress native scroll / rubber-band while actively pulling.
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (startY.current == null) return;
      const wasActive = activeRef.current;
      startY.current = null;
      activeRef.current = false;
      setSettling(true);
      if (wasActive && pullRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullBoth(THRESHOLD);
        Promise.resolve(onRefresh()).finally(() => {
          // Brief minimum display so the spinner reads as intentional.
          window.setTimeout(() => {
            refreshingRef.current = false;
            setRefreshing(false);
            setPullBoth(0);
          }, 450);
        });
      } else {
        setPullBoth(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh]);

  const progress = Math.min(1, pull / THRESHOLD);
  const transition = settling ? 'transform 0.28s cubic-bezier(0.22,1,0.36,1)' : 'none';

  return (
    <div ref={rootRef} className="relative">
      {/* Pull indicator */}
      <div
        className="absolute inset-x-0 top-0 flex justify-center pointer-events-none z-10"
        style={{
          transform: `translateY(${pull - 42}px)`,
          opacity: pull > 4 ? 1 : 0,
          transition: settling ? 'transform 0.28s cubic-bezier(0.22,1,0.36,1), opacity 0.2s' : 'opacity 0.1s',
        }}
      >
        <div className="w-9 h-9 rounded-full bg-card border border-border/30 shadow-md flex items-center justify-center">
          <RefreshCw
            className={cn('w-4 h-4 text-primary', refreshing && 'animate-spin')}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
              opacity: 0.45 + progress * 0.55,
            }}
          />
        </div>
      </div>

      {/* Content follows the pull */}
      <div style={{ transform: `translateY(${refreshing ? THRESHOLD * 0.5 : pull * 0.5}px)`, transition }}>
        {children}
      </div>
    </div>
  );
}
