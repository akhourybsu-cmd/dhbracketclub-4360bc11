// DH Club Home — Header (club command center title bar)
//
// Premium desktop header for the new Home dashboard:
//   • Large club name + personalized greeting
//   • Right-side action group:
//     - Search button (route to /chat search if available, else placeholder)
//     - Notifications bell with optional badge count
//     - Compact "Create" button → opens StartSomethingMenu
//     - Primary "Start Something" CTA → opens StartSomethingMenu
//     - User avatar → /profile
//
// On mobile the action group collapses to just bell + avatar; the
// primary CTAs move into the ClubPulseCard chips instead.

import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dhMonogram from '@/assets/dh-monogram.png';
import type { Club } from '@/contexts/ClubContext';
import { StartSomethingMenu } from './StartSomethingMenu';

interface Props {
  club: Club | null;
  displayName: string;
  avatarUrl: string | null;
  /** Total of pending actions surfaced as a small notification dot. */
  notificationCount?: number;
  /** Slugs of installed assets so the StartSomethingMenu only offers
   *  options the club has actually enabled. */
  installedSlugs: Set<string>;
}

const WEEKDAY_GREETING = (h: number) => {
  if (h < 5)  return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Late night';
};

export function HomeHeader({ club, displayName, avatarUrl, notificationCount = 0, installedSlugs }: Props) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const firstName = displayName?.split(' ')[0] || '';
  const greeting = WEEKDAY_GREETING(new Date().getHours());
  const accent = club?.accent_color ?? '152 72% 46%';

  return (
    <header className="flex items-start justify-between gap-3 mb-4">
      {/* Title block */}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl lg:text-[30px] font-extrabold tracking-tight leading-none truncate">
          {club?.name ?? 'DH Club'}
        </h1>
        <p className="text-[12.5px] text-muted-foreground/85 mt-1 leading-snug">
          {greeting}{firstName ? `, ${firstName}` : ''}
          {club?.name ? ` — here's what's happening in the club.` : ' — welcome.'}
        </p>
      </div>

      {/* Action group — full set on lg+, condensed on mobile */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Search — routes to chat which has the search dialog wired */}
        <button
          type="button"
          onClick={() => navigate('/chat')}
          aria-label="Search"
          className="hidden sm:inline-flex w-10 h-10 rounded-full items-center justify-center text-muted-foreground/80 hover:text-foreground hover:bg-muted/40 active:scale-95 transition"
          title="Search messages + activity"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications — badge ties to total unread / pending count */}
        <button
          type="button"
          onClick={() => navigate('/feed')}
          aria-label={notificationCount > 0 ? `Notifications: ${notificationCount}` : 'Notifications'}
          className="relative w-10 h-10 rounded-full inline-flex items-center justify-center text-muted-foreground/80 hover:text-foreground hover:bg-muted/40 active:scale-95 transition"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold tabular-nums"
              style={{
                background: `hsl(${accent})`,
                color: 'hsl(218 50% 6%)',
                boxShadow: `0 0 8px hsl(${accent} / 0.6), 0 0 0 2px hsl(var(--background))`,
              }}
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Compact Create button — same target as Start Something */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Create"
          className="hidden sm:inline-flex h-10 px-3 rounded-lg items-center gap-1.5 text-[12px] font-bold border border-border/40 bg-card/60 hover:bg-card hover:border-border/60 active:scale-95 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Create
        </button>

        {/* Primary CTA — Start Something opens the launcher menu */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="h-10 px-3.5 rounded-lg inline-flex items-center gap-1.5 text-[12.5px] font-extrabold active:scale-95 transition"
          style={{
            background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
            color: 'hsl(218 50% 6%)',
            boxShadow: `0 0 18px -4px hsl(${accent} / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.2)`,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Start Something</span>
        </button>

        {/* Avatar — routes to profile */}
        <Link
          to="/profile"
          aria-label="Profile"
          className="ml-1 w-10 h-10 rounded-full overflow-hidden inline-flex items-center justify-center flex-shrink-0 border border-border/40 hover:border-border/70 transition"
          style={{
            background: avatarUrl ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.25), hsl(${accent} / 0.05))`,
            color: `hsl(${accent})`,
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : displayName ? (
            <span className="text-sm font-extrabold">{displayName.charAt(0).toUpperCase()}</span>
          ) : (
            <img src={dhMonogram} alt="" className="w-7 h-7 object-contain opacity-90" />
          )}
        </Link>
      </div>

      {/* Start Something menu — controlled overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
            onClick={() => setMenuOpen(false)}
          >
            <div
              className="fixed inset-0 bg-background/70 backdrop-blur-sm"
              aria-hidden
            />
            <StartSomethingMenu
              accent={accent}
              installedSlugs={installedSlugs}
              onClose={() => setMenuOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
