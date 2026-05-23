// DH Club Home — Identity Header
//
// Ambient header that anchors the home screen. Larger breathing room
// than the old strip, no border, gradient glow keyed to the club's
// accent color so each club's home looks distinct.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import dhMonogram from '@/assets/dh-monogram.png';
import type { Club } from '@/contexts/ClubContext';

interface Props {
  club: Club | null;
  displayName: string;
  avatarUrl: string | null;
  /** Number of "Right Now" actions awaiting the user. Drives the avatar notification dot. */
  pendingCount: number;
  now?: Date;
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function greetingFor(hour: number): string {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Late night';
}

export function HomeHero({ club, displayName, avatarUrl, pendingCount, now = new Date() }: Props) {
  const accent = club?.accent_color ?? '152 72% 46%';
  const weekday = WEEKDAY[now.getDay()];
  const initial = (displayName?.[0] ?? '?').toUpperCase();
  const firstName = displayName?.split(' ')[0];
  const greeting = greetingFor(now.getHours());

  return (
    <motion.header
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative pt-2 pb-5 mb-1"
    >
      {/* Ambient accent glow keyed to club color */}
      <div
        aria-hidden
        className="absolute -inset-x-8 -top-20 h-56 pointer-events-none -z-10"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 50% 0%, hsl(${accent} / 0.28), transparent 72%)`,
        }}
      />

      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{
            background: club?.logo_url ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.24), hsl(${accent} / 0.06))`,
            border: `1px solid hsl(${accent} / 0.30)`,
            boxShadow: `0 0 18px -6px hsl(${accent} / 0.45)`,
          }}
        >
          {club?.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <img src={dhMonogram} alt={club?.name ?? 'DH'} className="w-7 h-7 object-contain opacity-90" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground/85 leading-tight">
            {weekday} · {greeting}{firstName ? `, ${firstName}` : ''}
          </p>
          <h1 className="text-[18px] font-extrabold tracking-tight truncate leading-tight mt-0.5">
            {club?.name ?? 'DH Club'}
          </h1>
        </div>

        <Link
          to="/profile"
          className="relative w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center text-sm font-extrabold btn-press"
          style={{
            background: avatarUrl ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.18), hsl(${accent} / 0.04))`,
            border: `1px solid hsl(${accent} / 0.28)`,
            color: `hsl(${accent})`,
          }}
          aria-label="Open profile"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : initial}
          {pendingCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-extrabold"
              style={{
                background: `hsl(${accent})`,
                color: 'hsl(218 50% 6%)',
                boxShadow: `0 0 10px hsl(${accent} / 0.5), 0 0 0 2px hsl(var(--background))`,
              }}
            >
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Link>
      </div>
    </motion.header>
  );
}
