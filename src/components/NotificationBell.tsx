import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { notifIcon } from '@/components/notifications/meta';

function Row({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  const { icon: Icon, color } = notifIcon(n.type);
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/30',
        !n.read_at && 'bg-primary/[0.05]',
      )}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `linear-gradient(135deg, hsl(var(--${color}) / 0.16), hsl(var(--${color}) / 0.04))` }}
      >
        <Icon className="w-4 h-4" style={{ color: `hsl(var(--${color}))` }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold leading-snug text-foreground/90 line-clamp-2">{n.title}</p>
        {n.body && <p className="text-[11px] text-muted-foreground/70 leading-snug line-clamp-2 mt-0.5">{n.body}</p>}
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
          {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
      {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" aria-label="Unread" />}
    </button>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 56, right: 8 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Anchor the panel below the bell, right-edge aligned to the bell,
      // clamped so it never runs off-screen (works for the mobile top-right
      // bell and the desktop sidebar bell alike).
      setPos({
        top: Math.round(r.bottom + 8),
        right: Math.max(8, Math.round(window.innerWidth - r.right)),
      });
    }
    setOpen(v => !v);
  };

  const openItem = (n: AppNotification) => {
    void markRead(n.id);
    setOpen(false);
    if (n.url) navigate(n.url);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        className={cn(
          'relative rounded-full flex items-center justify-center transition-colors hover:bg-muted/40 active:bg-muted/60',
          className,
        )}
      >
        <Bell className="w-5 h-5 text-foreground/85" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-black flex items-center justify-center ring-2 ring-background tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="fixed inset-0 z-[65]"
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className="fixed z-[66] w-[calc(100vw-1rem)] max-w-[380px] rounded-2xl border border-border/20 bg-popover/95 backdrop-blur-lg shadow-2xl overflow-hidden"
                style={{ top: pos.top, right: pos.right }}
              >
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/15">
                  <h3 className="text-[13px] font-extrabold tracking-tight">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => void markAllRead()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[min(70vh,440px)] overflow-y-auto divide-y divide-border/10">
                  {loading ? (
                    <div className="p-3 space-y-2">
                      {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg skeleton-shimmer" />)}
                    </div>
                  ) : items.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-primary/10">
                        <Bell className="w-6 h-6 text-primary/60" />
                      </div>
                      <p className="text-[13px] font-bold mb-0.5">You're all caught up</p>
                      <p className="text-[11px] text-muted-foreground/65">Mentions, replies, and turns show up here.</p>
                    </div>
                  ) : (
                    items.map(n => <Row key={n.id} n={n} onClick={() => openItem(n)} />)
                  )}
                </div>

                {items.length > 0 && (
                  <button
                    onClick={() => { setOpen(false); navigate('/notifications'); }}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2.5 border-t border-border/15 text-[12px] font-semibold text-primary/80 hover:text-primary hover:bg-muted/20 transition-colors"
                  >
                    See all notifications <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
