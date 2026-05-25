import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const TAPE_SYMBOLS = [
  'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD',
  'NFLX', 'AVGO', 'JPM', 'V', 'COIN', 'PLTR', 'SHOP', 'UBER', 'DIS',
];

// Fallback static seed if quotes can't be fetched (preserves the "alive" feel).
const FALLBACK: { symbol: string; pct: number }[] = [
  { symbol: 'AAPL', pct: 1.24 }, { symbol: 'NVDA', pct: -0.82 },
  { symbol: 'MSFT', pct: 0.44 }, { symbol: 'TSLA', pct: 2.16 },
  { symbol: 'AMZN', pct: -0.31 }, { symbol: 'META', pct: 0.91 },
  { symbol: 'GOOGL', pct: 0.18 }, { symbol: 'AMD', pct: -1.42 },
  { symbol: 'NFLX', pct: 1.07 }, { symbol: 'AVGO', pct: 0.55 },
  { symbol: 'JPM', pct: 0.22 }, { symbol: 'V', pct: -0.14 },
  { symbol: 'COIN', pct: 3.87 }, { symbol: 'PLTR', pct: 2.41 },
  { symbol: 'SHOP', pct: -0.66 }, { symbol: 'UBER', pct: 1.33 },
  { symbol: 'DIS', pct: -0.27 },
];

async function fetchQuote(symbol: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pw-quote?symbol=${symbol}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (j.current == null || j.prev_close == null || j.prev_close === 0) return null;
    const pct = ((j.current - j.prev_close) / j.prev_close) * 100;
    return { symbol, pct };
  } catch { return null; }
}

function useTape() {
  return useQuery({
    queryKey: ['pw-ticker-tape'],
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    queryFn: async () => {
      const results = await Promise.all(TAPE_SYMBOLS.map(fetchQuote));
      const live = results.filter(Boolean) as { symbol: string; pct: number }[];
      // Merge with fallback so we always show every symbol even if some fail.
      const map = new Map(FALLBACK.map((f) => [f.symbol, f.pct]));
      live.forEach((q) => map.set(q.symbol, q.pct));
      return Array.from(map.entries()).map(([symbol, pct]) => ({ symbol, pct }));
    },
  });
}

/** Sticky scrolling ticker tape — sits between HUD and content. */
export function TickerTape() {
  const { data } = useTape();
  const items = data && data.length ? data : FALLBACK;
  // Duplicate list for seamless infinite scroll.
  const loop = [...items, ...items];

  return (
    <div
      className="sticky z-30 w-full overflow-hidden"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
        background:
          'linear-gradient(180deg, hsl(220 55% 4% / 0.98), hsl(220 55% 6% / 0.92))',
        borderBottom: '1px solid hsl(152 80% 50% / 0.18)',
        boxShadow: 'inset 0 1px 0 hsl(152 80% 50% / 0.10)',
      }}
      aria-label="Live ticker tape"
    >
      <div className="relative h-7 flex items-center">
        {/* Edge fades */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10"
          style={{ background: 'linear-gradient(90deg, hsl(220 55% 4%), transparent)' }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10"
          style={{ background: 'linear-gradient(270deg, hsl(220 55% 4%), transparent)' }}
        />
        <div
          className="flex gap-5 whitespace-nowrap will-change-transform"
          style={{
            animation: 'pw-tape-scroll 60s linear infinite',
          }}
        >
          {loop.map((q, i) => {
            const pos = q.pct >= 0;
            return (
              <span
                key={`${q.symbol}-${i}`}
                className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider font-mono"
              >
                <span style={{ color: 'hsl(150 15% 88%)' }}>{q.symbol}</span>
                <span
                  className="px-1.5 py-0.5 rounded tabular-nums"
                  style={{
                    background: pos ? 'hsl(152 80% 50% / 0.14)' : 'hsl(0 75% 60% / 0.14)',
                    color: pos ? 'hsl(152 80% 65%)' : 'hsl(0 80% 70%)',
                  }}
                >
                  {pos ? '+' : ''}{q.pct.toFixed(2)}%
                </span>
                <span style={{ color: 'hsl(150 8% 30%)' }}>·</span>
              </span>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes pw-tape-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
