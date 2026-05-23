// DH Club Home — Today Feed
//
// A single flowing list that consolidates "what's happening in the club
// right now": secondary next-actions, upcoming events, recent celebratory
// activity, and (later) plugin-contributed signals. Rows share one calm
// recipe — leading icon chip, title + meta, time/right-meta, optional
// chevron — and are separated by hair-line dividers, NOT per-row borders.
//
// Replaces the visual stack of (RightNow expander · ClubPulse card ·
// EventsStrip rail · Celebrations Upcoming card) that all had their own
// chrome.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { formatDistanceToNow, isToday, isTomorrow, format } from 'date-fns';
import { Surface } from './primitives/Surface';
import { SectionLabel } from './SectionLabel';

export interface TodayFeedItem {
  id: string;
  /** Leading icon. */
  icon: LucideIcon;
  /** HSL components, e.g. "45 95% 55%". */
  tint: string;
  /** Bold one-line title. */
  title: string;
  /** Faint supporting line under the title. */
  sub?: string;
  /** Right-side meta — usually a relative time or short tag. */
  meta?: string;
  /** If true, render a small animated dot in the tint color instead of/with meta. */
  live?: boolean;
  /** Route to navigate to. */
  to: string;
  /** ISO timestamp used for sorting if `meta` not provided. */
  at?: string;
}

interface Props {
  items: TodayFeedItem[];
  /** Section title — usually "Today in {Club}". */
  title?: string;
  sublabel?: string;
}

export function TodayFeed({ items, title = 'Today', sublabel }: Props) {
  if (items.length === 0) return null;
  const top = items.slice(0, 6);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6"
    >
      <SectionLabel label={title} sublabel={sublabel} />
      <Surface variant="pulse">
        <ul>
          {top.map((it, idx) => (
            <motion.li
              key={it.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.32, delay: idx * 0.045, ease: [0.22, 1, 0.36, 1] }}
              style={idx > 0 ? { borderTop: '1px solid hsl(var(--border) / 0.22)' } : undefined}
            >
              <Link
                to={it.to}
                className="flex items-center gap-3 px-3.5 py-3 active:bg-foreground/5 transition-colors"
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${it.tint} / 0.18), hsl(${it.tint} / 0.04))`,
                    color: `hsl(${it.tint})`,
                    boxShadow: `inset 0 0 0 1px hsl(${it.tint} / 0.16)`,
                  }}
                >
                  <it.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold tracking-tight leading-tight truncate">
                    {it.title}
                  </p>
                  {it.sub && (
                    <p className="text-[11.5px] text-muted-foreground/70 leading-snug truncate mt-0.5">
                      {it.sub}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {it.live && (
                    <span
                      aria-hidden
                      className="w-1.5 h-1.5 rounded-full motion-safe:animate-[feedPulse_1.8s_ease-in-out_infinite]"
                      style={{ background: `hsl(${it.tint})`, boxShadow: `0 0 6px hsl(${it.tint} / 0.7)` }}
                    />
                  )}
                  {it.meta && (
                    <span className="text-[10.5px] font-semibold tabular-nums text-muted-foreground/65">
                      {it.meta}
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/45" />
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
        <style>{`@keyframes feedPulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }`}</style>
      </Surface>
    </motion.section>
  );
}

/* ── Helpers callers can use to format `meta` consistently ──────────── */
export function formatWhenSoon(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mma').toLowerCase();
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}
export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: false });
}
