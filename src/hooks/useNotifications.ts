import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  user_id: string;
  club_id: string | null;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  actor_user_id: string | null;
  read_at: string | null;
  created_at: string;
}

// notifications isn't in the generated types yet — use the escape hatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface UseNotificationsOpts {
  pageSize?: number;
  /** Restrict the list to unread items (used by the full-page "Unread" tab). */
  unreadOnly?: boolean;
}

/**
 * In-app notification inbox: recent items + live unread count for the current
 * user. Rows are written server-side by send-push-notification; RLS scopes
 * reads/writes to the owner, and realtime keeps everything live.
 *
 * Serves both the header bell (default opts) and the full page (paginated +
 * filtered via `unreadOnly`).
 */
export function useNotifications({ pageSize = 30, unreadOnly = false }: UseNotificationsOpts = {}) {
  const { user } = useAuth();
  const uid = user?.id;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const baseQuery = useCallback(() => {
    let q = sb.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (unreadOnly) q = q.is('read_at', null);
    return q;
  }, [uid, unreadOnly]);

  const load = useCallback(async () => {
    if (!uid) { setItems([]); setLoading(false); return; }
    const { data } = await baseQuery().limit(pageSize);
    const rows = (data ?? []) as AppNotification[];
    setItems(rows);
    setHasMore(rows.length === pageSize);
    setLoading(false);
  }, [uid, baseQuery, pageSize]);

  const loadMore = useCallback(async () => {
    if (!uid || loadingMore || items.length === 0) return;
    setLoadingMore(true);
    const cursor = items[items.length - 1].created_at;
    const { data } = await baseQuery().lt('created_at', cursor).limit(pageSize);
    const rows = (data ?? []) as AppNotification[];
    setItems(prev => {
      const seen = new Set(prev.map(p => p.id));
      return [...prev, ...rows.filter(r => !seen.has(r.id))];
    });
    setHasMore(rows.length === pageSize);
    setLoadingMore(false);
  }, [uid, items, baseQuery, pageSize, loadingMore]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  // Granular realtime so pagination isn't reset on every change.
  useEffect(() => {
    if (!uid) return;
    const ch = sb
      .channel(`notifications-${uid}-${unreadOnly ? 'u' : 'a'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (p: any) => {
          const row = p.new as AppNotification;
          if (unreadOnly && row.read_at) return;
          setItems(prev => (prev.some(x => x.id === row.id) ? prev : [row, ...prev]));
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (p: any) => {
          const row = p.new as AppNotification;
          setItems(prev => prev.map(x => (x.id === row.id ? row : x)));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' },
        (p: any) => setItems(prev => prev.filter(x => x.id !== p.old?.id)))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [uid, unreadOnly]);

  const unreadCount = items.reduce((n, x) => n + (x.read_at ? 0 : 1), 0);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)));
    await sb.from('notifications').update({ read_at: now }).eq('id', id).is('read_at', null);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => (n.read_at ? n : { ...n, read_at: now })));
    await sb.from('notifications').update({ read_at: now }).eq('user_id', uid).is('read_at', null);
  }, [uid]);

  const dismiss = useCallback(async (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
    await sb.from('notifications').delete().eq('id', id);
  }, []);

  return { items, unreadCount, loading, loadingMore, hasMore, loadMore, markRead, markAllRead, dismiss, refresh: load };
}
