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
      className="relative pt-1 pb-3.5 mb-1"
    >
      {/* Ambient accent glow keyed to club color — kept as the premium
          signature, but slimmer so the primary action below dominates. */}
      <div
        aria-hidden
        className="absolute -inset-x-8 -top-16 h-44 pointer-events-none -z-10"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 50% 0%, hsl(${accent} / 0.22), transparent 72%)`,
        }}
      />

      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{
            background: club?.logo_url ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.24), hsl(${accent} / 0.06))`,
            border: `1px solid hsl(${accent} / 0.30)`,
            boxShadow: `0 0 14px -5px hsl(${accent} / 0.5)`,
          }}
        >
          {club?.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <img src={dhMonogram} alt={club?.name ?? 'DH'} className="w-6 h-6 object-contain opacity-90" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-extrabold tracking-tight truncate leading-none">
            {club?.name ?? 'DH Club'}
          </h1>
          <p className="text-[10.5px] font-medium text-muted-foreground/80 leading-tight truncate mt-1">
            {weekday} · {greeting}{firstName ? `, ${firstName}` : ''}
          </p>
        </div>

        <Link
          to="/profile"
          className="relative w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center text-[13px] font-extrabold btn-press"
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
              className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center text-[9px] font-extrabold"
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
