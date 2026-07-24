import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, X, Loader2 } from 'lucide-react';
import { formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { notifIcon } from '@/components/notifications/meta';

type Tab = 'all' | 'unread';

function bucketOf(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return 'Earlier';
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const { items, unreadCount, loading, loadingMore, hasMore, loadMore, markRead, markAllRead, dismiss } =
    useNotifications({ pageSize: 30, unreadOnly: tab === 'unread' });

  // Infinite scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  const groups = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const n of items) {
      const b = bucketOf(n.created_at);
      (map.get(b) ?? map.set(b, []).get(b)!).push(n);
    }
    return [...map.entries()];
  }, [items]);

  const openItem = (n: AppNotification) => {
    void markRead(n.id);
    if (n.url) navigate(n.url);
  };

  return (
    <div className="pb-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="page-header mb-0">
            <div className="page-header-icon"><Bell className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} /></div>
            <div>
              <h1 className="page-header-title">Notifications</h1>
              <p className="page-header-subtitle">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-muted/50 hover:bg-muted text-[12px] font-bold btn-press"
            >
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/30 mb-4 w-fit">
          {(['all', 'unread'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 h-8 rounded-lg text-[12px] font-bold capitalize transition-colors',
                tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground/70 hover:text-foreground/85',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="glass-card h-16" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-primary/10">
              <Bell className="w-7 h-7 text-primary/60" />
            </div>
            <p className="text-sm font-bold mb-1">{tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
            <p className="text-[12px] text-muted-foreground/65">Mentions, replies, turns, and RSVPs will show up here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([label, group]) => (
              <div key={label}>
                <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/55 mb-2">{label}</h2>
                <div className="glass-card overflow-hidden divide-y divide-border/10">
                  {group.map(n => {
                    const { icon: Icon, color } = notifIcon(n.type);
                    return (
                      <div
                        key={n.id}
                        className={cn('group flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-muted/20', !n.read_at && 'bg-primary/[0.05]')}
                      >
                        <button onClick={() => openItem(n)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `linear-gradient(135deg, hsl(var(--${color}) / 0.16), hsl(var(--${color}) / 0.04))` }}
                          >
                            <Icon className="w-4 h-4" style={{ color: `hsl(var(--${color}))` }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-snug text-foreground/90">{n.title}</p>
                            {n.body && <p className="text-[11.5px] text-muted-foreground/70 leading-snug line-clamp-2 mt-0.5">{n.body}</p>}
                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                          {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary" aria-label="Unread" />}
                          <button
                            onClick={() => void dismiss(n.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground/80 hover:bg-muted/40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div ref={sentinelRef} className="h-8 flex items-center justify-center">
              {loadingMore && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
