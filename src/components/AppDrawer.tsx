import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquareText, CalendarDays, Swords, Newspaper,
  User, Trophy, BarChart3, MessageCircle, Bookmark, Link2, ScrollText,
  Lock, FileText, Sparkles, Shield, Settings, LogOut, Brackets as BracketsIcon, TrendingUp, Cake, BookOpen, BookMarked, Flame, Compass, LayoutGrid,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { useClubAssets } from '@/hooks/useClubAssets';
import dhMonogram from '@/assets/dh-monogram.png';

type NavEntry = { path: string; label: string; icon: any; badge?: number };
type Section = { label: string; items: NavEntry[] };

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unreadChatCount?: number;
}

export function AppDrawer({ open, onOpenChange, unreadChatCount = 0 }: AppDrawerProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { club, isClubAdmin, isPlatformOwner, isAppAdmin } = useClub();
  const { play } = useSoundEffect();
  const { filterNavPaths, installedAssets, isVisible } = useClubAssets();

  // Close on route change
  useEffect(() => { if (open) onOpenChange(false); /* eslint-disable-next-line */ }, [location.pathname]);

  const rawSections: Section[] = [
    {
      label: 'Main',
      items: [
        { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
        { path: '/chat', label: 'Chat', icon: MessageSquareText, badge: unreadChatCount },
        { path: '/compete', label: 'Compete', icon: Swords },
        { path: '/events', label: 'Events', icon: CalendarDays },
        { path: '/lore', label: 'Lore', icon: ScrollText },
        { path: '/feed', label: 'Feed', icon: Newspaper },
        { path: '/celebrations', label: 'Celebrations', icon: Cake },
      ],
    },
    {
      label: 'Games',
      items: [
        { path: '/drafts', label: 'Draft Arena', icon: Bookmark },
        { path: '/rune-delve', label: 'Rune Delve', icon: Sparkles },
        { path: '/nexus', label: 'Nexus Defense', icon: Shield },
        { path: '/pickem', label: "NFL Pick'em", icon: Trophy },
        { path: '/brackets', label: 'Brackets', icon: BracketsIcon },
        { path: '/portfolio-wars', label: 'Portfolio Wars', icon: TrendingUp },
        { path: '/lockbox', label: 'Lockbox', icon: Lock },
        { path: '/readshift', label: 'READSHIFT', icon: BookMarked },
        { path: '/workouts', label: 'FORGE', icon: Flame },
      ],
    },
    {
      label: 'Community',
      items: [
        { path: '/narrative', label: 'Narrative RPG', icon: BookOpen },
        { path: '/journey', label: 'The Splendid Journey', icon: Compass },
        { path: '/polls', label: 'Polls', icon: MessageCircle },
        { path: '/rankings', label: 'Rankings', icon: BarChart3 },
        { path: '/posts', label: 'Posts', icon: FileText },
        { path: '/shared', label: 'Shared Media', icon: Link2 },
      ],
    },
    {
      label: 'Account',
      items: [
        { path: '/profile', label: 'Profile', icon: User },
      ],
    },
  ];

  const sections: Section[] = rawSections.map(sec => ({
    ...sec,
    items: sec.items.filter(item => filterNavPaths([item.path]).length > 0),
  })).filter(sec => sec.items.length > 0);

  if (isClubAdmin || isPlatformOwner || isAppAdmin) {
    sections.push({
      label: 'Admin',
      items: [
        ...(isClubAdmin ? [{ path: '/club/settings', label: 'Club Settings', icon: Settings }] : []),
        ...((isAppAdmin || isPlatformOwner) ? [{ path: '/admin', label: 'Admin Portal', icon: Shield }] : []),
      ],
    });
  }

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/brackets') return location.pathname.startsWith('/brackets') || location.pathname.startsWith('/pools');
    if (path === '/compete') return location.pathname === '/compete';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="p-0 w-[86vw] max-w-[340px] sm:max-w-[360px] flex flex-col gap-0 border-r border-border/30 bg-background"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SheetDescription className="sr-only">Browse all sections of the app</SheetDescription>

        {/* Identity header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/25 flex items-center gap-3">
          {club?.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-11 h-11 object-cover rounded-xl" />
          ) : (
            <img src={dhMonogram} alt="DH" className="w-11 h-11 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-extrabold tracking-tight leading-tight truncate gradient-text">
              {club?.name ?? 'DH Club'}
            </h2>
            <p className="text-[10px] text-muted-foreground/80 font-semibold uppercase tracking-[0.14em] mt-0.5 truncate">
              {user?.email ?? 'Compete With Your Crew'}
            </p>
          </div>
        </div>

        {/* Nav scroll area */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {sections.map((sec) => (
            <div key={sec.label} className="mb-3">
              {/* Matches the SectionHeader spec used across Home so eyebrows
                  read as one visual family across the shell. */}
              <p className="px-3 mb-1 text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">
                {sec.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => { play('tap'); }}
                      className={cn(
                        'group flex items-center gap-3 px-3 py-2.5 rounded-xl min-h-[44px] text-[14px] font-medium transition-colors',
                        active
                          ? 'bg-primary/15 text-primary'
                          : 'text-foreground/85 hover:bg-muted/50 active:bg-muted/70',
                      )}
                    >
                      <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', active && 'text-primary')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        // Unread count chip — uses the calm-shell pill family
                        // (token-driven, no hardcoded color) so it visually
                        // belongs with StatusPill chips elsewhere.
                        <span
                          className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold tabular-nums flex items-center justify-center border"
                          style={{
                            backgroundColor: 'hsl(var(--primary) / 0.18)',
                            borderColor: 'hsl(var(--primary) / 0.4)',
                            color: 'hsl(var(--primary))',
                          }}
                        >
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/25 flex items-center justify-between gap-2">
          <ThemeToggle />
          <button
            onClick={async () => { play('tap'); await signOut(); }}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-destructive transition-colors px-3 py-2 rounded-lg hover:bg-destructive/10 min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
