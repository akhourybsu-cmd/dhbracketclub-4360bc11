import { motion } from 'framer-motion';

export interface Contribution {
  userId: string;
  name: string;
  value: number;
  color: string;
  isMe: boolean;
}

/**
 * Club-goal progress bar broken into one colored segment per contributor, so
 * the club can see exactly who fed which slice. Segments are proportional to
 * the goal (not to each other), so the bar only fills as the club progresses.
 */
export function ContributionBar({
  contributions, target, height = 12, showLegend = true, formatValue,
}: {
  contributions: Contribution[];
  target: number;
  height?: number;
  showLegend?: boolean;
  formatValue?: (v: number) => string;
}) {
  const rows = contributions.filter(c => c.value > 0).sort((a, b) => b.value - a.value);
  const total = rows.reduce((t, c) => t + c.value, 0);
  const denom = Math.max(target, total, 1);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString());

  return (
    <div>
      <div className="relative w-full rounded-full overflow-hidden flex"
        style={{ height, background: 'hsl(220 14% 20% / 0.75)' }}>
        {rows.map((c, i) => (
          <motion.div
            key={c.userId}
            className="h-full relative"
            style={{
              background: `linear-gradient(180deg, ${c.color}, ${c.color.replace(/\)$/, ' / 0.75)')})`,
              boxShadow: c.isMe ? `0 0 10px -2px ${c.color}` : undefined,
              borderRight: i < rows.length - 1 ? '1px solid hsl(222 20% 8% / 0.6)' : undefined,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${(c.value / denom) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 30, delay: 0.03 * i }}
            title={`${c.name}: ${fmt(c.value)}`}
          />
        ))}
      </div>

      {showLegend && rows.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {rows.slice(0, 8).map(c => (
            <div key={c.userId} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
              <span className="text-[10px] font-bold" style={{ color: c.isMe ? c.color : 'hsl(30 20% 72%)' }}>
                {c.isMe ? 'You' : c.name}
              </span>
              <span className="text-[10px] font-black tabular-nums" style={{ color: 'hsl(28 25% 58%)' }}>{fmt(c.value)}</span>
            </div>
          ))}
          {rows.length > 8 && (
            <span className="text-[10px] font-bold" style={{ color: 'hsl(28 25% 55%)' }}>+{rows.length - 8} more</span>
          )}
        </div>
      )}
      {showLegend && rows.length === 0 && (
        <p className="text-[10px] font-bold mt-2" style={{ color: 'hsl(28 25% 52%)' }}>No contributions yet — be first on the board.</p>
      )}
    </div>
  );
}
