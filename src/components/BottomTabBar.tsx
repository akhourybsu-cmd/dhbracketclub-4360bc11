import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, MessageSquareText, Swords, Newspaper, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSoundEffect } from '@/hooks/useSoundEffect';

interface Tab {
  path: string;
  label: string;
  icon: LucideIcon;
  isActive: (p: string) => boolean;
  badge?: number;
}

/**
 * Persistent mobile bottom tab bar — one-tap access to the core sections with
 * a spring-animated active indicator, tap haptics, and a live chat badge.
 * Hidden on desktop (sidebar takes over) and inside full-screen shells
 * (chat / game modes), which AppLayout gates via `showMobileHeader`.
 */
export function BottomTabBar({ unreadChatCount = 0 }: { unreadChatCount?: number }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { play } = useSoundEffect();

  const tabs: Tab[] = [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard, isActive: p => p === '/dashboard' },
    { path: '/chat', label: 'Chat', icon: MessageSquareText, isActive: p => p.startsWith('/chat'), badge: unreadChatCount },
    { path: '/compete', label: 'Compete', icon: Swords, isActive: p => p === '/compete' },
    { path: '/feed', label: 'Feed', icon: Newspaper, isActive: p => p === '/feed' },
    { path: '/profile', label: 'You', icon: User, isActive: p => p.startsWith('/profile') },
  ];

  const go = (path: string, active: boolean) => {
    if (active) return;
    play('tap');
    navigator.vibrate?.(8);
    navigate(path);
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/25 bg-background/85"
      style={{
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
      aria-label="Primary"
    >
      <div className="flex items-stretch">
        {tabs.map(tab => {
          const active = tab.isActive(pathname);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => go(tab.path, active)}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 h-14 min-w-0 active:scale-95 transition-transform"
            >
              <div className="relative flex items-center justify-center w-12 h-7">
                {active && (
                  <motion.div
                    layoutId="bottomTabGlow"
                    className="absolute inset-0 rounded-full bg-primary/15"
                    transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                  />
                )}
                <Icon
                  className={cn('relative w-[22px] h-[22px] transition-colors duration-150', active ? 'text-primary' : 'text-muted-foreground/55')}
                  strokeWidth={active ? 2.4 : 2}
                />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-destructive-foreground text-[8.5px] font-black flex items-center justify-center ring-2 ring-background tabular-nums">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={cn('text-[9.5px] font-bold tracking-tight transition-colors duration-150', active ? 'text-primary' : 'text-muted-foreground/50')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
