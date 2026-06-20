// DH Club Home — Club Pulse hero card
//
// Replaces the previous "All caught up" empty hero with a richer
// command-center surface that ALWAYS surfaces 3 quick-action chips
// the user can act on, regardless of whether there's a pending
// action. Right-side decorative artwork is the DhShield SVG.
//
// Pending-vs-quiet states share the same chrome but differ in copy:
//   • Quiet (no pendingAction) → "Nothing urgent right now"
//   • Urgent (pendingAction present) → the action's label as the
//     headline, with its sub-line as the copy
//
// The three chips are stable and always-actionable:
//   1. Start a Poll        → /polls   (or asset library if not installed)
//   2. Open Draft Arena    → /drafts  (or asset library if not installed)
//   3. Check Activity      → scrolls/anchors to the Today feed below
//
// If an action's asset isn't installed, the chip stays visible but
// dims and links to the asset library so users can install it.

import { Link } from 'react-router-dom';
import { MessageCircle, Bookmark, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { Club } from '@/contexts/ClubContext';
import type { NextAction } from '@/lib/home/nextAction';
import { DhShield } from './svg/DhShield';

interface Props {
  club: Club | null;
  /** Highest-priority next action from `rankNextActions`, if any.
   *  Drives the headline copy when set; quiet state when null. */
  pendingAction: NextAction | null;
  installedSlugs: Set<string>;
  /** Anchor id for the activity feed below — Check Activity chip
   *  scrolls there instead of routing away. */
  activityAnchorId: string;
}

interface ChipDef {
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Slug we gate on; if not installed, chip routes to /club/assets. */
  gateSlug?: string;
  to: string;
  /** Optional click handler — if set, runs INSTEAD of navigating. */
  onActivate?: () => void;
}

export function ClubPulseCard({ club, pendingAction, installedSlugs, activityAnchorId }: Props) {
  const accent = club?.accent_color ?? '152 72% 46%';

  const headline = pendingAction ? pendingAction.label : 'Nothing urgent right now';
  const sub = pendingAction
    ? (pendingAction.sub ?? 'Tap below to handle it now.')
    : "You're caught up across drafts, polls, and RPG sessions.";

  const chips: ChipDef[] = [
    { label: 'Start a Poll',      hint: 'Get crew input',     icon: MessageCircle, gateSlug: 'polls',       to: '/polls' },
    { label: 'Open Draft Arena',  hint: 'Make your picks',    icon: Bookmark,      gateSlug: 'draft-arena', to: '/drafts' },
    {
      label: 'Check Activity',
      hint: "See what's new",
      icon: Sparkles,
      to: `#${activityAnchorId}`,
      // Smooth-scroll into view instead of routing away.
      onActivate: () => {
        const el = document.getElementById(activityAnchorId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl mb-6"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 0% 50%, hsl(${accent} / 0.10), transparent 60%),
          linear-gradient(180deg, hsl(218 30% 8% / 0.85), hsl(218 40% 5% / 0.92))
        `,
        border: `1px solid hsl(${accent} / 0.32)`,
        boxShadow: `0 16px 48px -16px hsl(${accent} / 0.35), inset 0 1px 0 hsl(${accent} / 0.18)`,
      }}
    >
      {/* Right-side shield artwork. Absolute-positioned so the text
          column can grow to its natural width; the shield clips
          gracefully on narrow screens via overflow-hidden on parent. */}
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-[280px] hidden md:block pointer-events-none"
        style={{ opacity: 0.85 }}
      >
        <DhShield
          accent={accent}
          monogram={club?.name?.charAt(0).toUpperCase() ?? 'DH'}
          className="w-full h-full"
        />
      </div>

      <div className="relative p-5 lg:p-6 md:pr-[260px]">
        {/* Eyebrow */}
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: `hsl(${accent})` }} />
          <span
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: `hsl(${accent})` }}
          >
            Club Pulse
          </span>
        </div>

        {/* Headline + copy */}
        <h2 className="text-[22px] lg:text-[26px] font-extrabold tracking-tight leading-tight">
          {headline}
        </h2>
        <p className="text-[12.5px] text-muted-foreground/85 leading-snug mt-1.5 max-w-md">
          {sub}
        </p>

        {/* 3 action chips — stack on mobile, row on sm+. Each chip
            either navigates (Link) or fires onActivate (button). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5 max-w-3xl">
          {chips.map((chip) => {
            const Icon = chip.icon;
            const isInstalled = !chip.gateSlug || installedSlugs.has(chip.gateSlug);
            const destination = isInstalled ? chip.to : '/club/assets';

            const inner = (
              <>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `hsl(${accent} / 0.15)`,
                    color: `hsl(${accent})`,
                    border: `1px solid hsl(${accent} / 0.3)`,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[12.5px] font-extrabold tracking-tight leading-tight">
                    {chip.label}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground/70 leading-tight mt-0.5">
                    {isInstalled ? chip.hint : 'Install to unlock'}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/55 flex-shrink-0" />
              </>
            );

            const classes = "flex items-center gap-2.5 rounded-xl p-2.5 transition-colors hover:bg-card/80 active:scale-[0.98]";
            const style = {
              background: 'hsl(218 30% 6% / 0.5)',
              border: '1px solid hsl(var(--border) / 0.4)',
              opacity: isInstalled ? 1 : 0.6,
            } as const;

            if (chip.onActivate && isInstalled) {
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onActivate}
                  className={classes}
                  style={style}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link key={chip.label} to={destination} className={classes} style={style}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
