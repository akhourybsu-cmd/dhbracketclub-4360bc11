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
const PAGE = 30;

/**
 * In-app notification inbox: recent items + live unread count for the current
 * user. Rows are written server-side by send-push-notification; RLS scopes
 * reads/writes to the owner, and realtime keeps the badge live.
 */
export function useNotifications() {
  const { user } = useAuth();
  const uid = user?.id;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) { setItems([]); setLoading(false); return; }
    const { data } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    setItems((data ?? []) as AppNotification[]);
    setLoading(false);
  }, [uid]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  // Live updates — any insert/update/delete on the caller's rows refetches.
  useEffect(() => {
    if (!uid) return;
    const ch = sb
      .channel(`notifications-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [uid, load]);

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

  return { items, unreadCount, loading, markRead, markAllRead, refresh: load };
}
