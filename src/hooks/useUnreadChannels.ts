// DH Club — Home unread-chats hook
//
// Returns the list of channels the current user has unread messages
// in, filtered by the channel notification preferences they've set
// (muted channels never surface here, since the whole point of mute
// is "don't tell me about new messages").
//
// Powers the "New chat to view in #X" surface on the home page.
// AppLayout has its own lighter `unreadChatCount` query for the
// sidebar badge; this hook returns the structured per-channel list
// instead of a single count, so the Home next-action ranker can
// render the channel names directly.
//
// Refresh strategy: polls every 30s and exposes a manual `refresh()`
// for caller-driven updates (e.g. on tab focus or after the user
// returns from /chat).

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UnreadChannel {
  /** Channel UUID. */
  id: string;
  /** Channel name as-stored (no '#' prefix; callers add it). */
  name: string;
  /** ISO timestamp of the latest unread message — used to sort. */
  lastMessageAt: string;
}

interface UseUnreadChannelsResult {
  unreadChannels: UnreadChannel[];
  /** Manually re-fetch — call after the user returns from /chat or on tab focus. */
  refresh: () => void;
}

const POLL_INTERVAL_MS = 30_000;

export function useUnreadChannels(): UseUnreadChannelsResult {
  const { user } = useAuth();
  const [unreadChannels, setUnreadChannels] = useState<UnreadChannel[]>([]);
  const lastFetchAtRef = useRef(0);

  const fetchNow = useCallback(async () => {
    if (!user) {
      setUnreadChannels([]);
      return;
    }
    lastFetchAtRef.current = Date.now();

    // Pull channels, notification prefs, read states in parallel.
    // `channel_notification_prefs` and `channel_read_states` may not
    // exist for every (user, channel) pair — absence implies the
    // defaults (all-notifications, never-read).
    const [channelsRes, prefsRes, readsRes] = await Promise.all([
      supabase.from('channels').select('id, name'),
      (supabase as any).from('channel_notification_prefs').select('channel_id, mode').eq('user_id', user.id),
      (supabase as any).from('channel_read_states').select('channel_id, last_read_at').eq('user_id', user.id),
    ]);

    const channels = (channelsRes.data ?? []) as Array<{ id: string; name: string }>;
    if (channels.length === 0) { setUnreadChannels([]); return; }

    const prefMap = new Map<string, string>();
    (prefsRes.data as any[] ?? []).forEach(p => prefMap.set(p.channel_id, p.mode));

    const readMap = new Map<string, string>();
    (readsRes.data as any[] ?? []).forEach(r => readMap.set(r.channel_id, r.last_read_at));

    // Filter to channels where notifications aren't fully muted. The
    // default (no row in prefs) is treated as "all" — same convention
    // as the AppLayout badge query.
    const enabledChannels = channels.filter(c => prefMap.get(c.id) !== 'muted');
    if (enabledChannels.length === 0) { setUnreadChannels([]); return; }

    // Fetch the most recent top-level messages across all enabled
    // channels in one round-trip. 200 is plenty — we only care about
    // the first occurrence per channel since results come back DESC.
    const { data: msgs } = await supabase
      .from('messages')
      .select('channel_id, user_id, created_at')
      .is('parent_message_id', null)
      .in('channel_id', enabledChannels.map(c => c.id))
      .order('created_at', { ascending: false })
      .limit(200);

    const latestPerChannel = new Map<string, { authorId: string; createdAt: string }>();
    (msgs ?? []).forEach((m: any) => {
      if (!latestPerChannel.has(m.channel_id)) {
        latestPerChannel.set(m.channel_id, { authorId: m.user_id, createdAt: m.created_at });
      }
    });

    const nameById = new Map(enabledChannels.map(c => [c.id, c.name]));
    const result: UnreadChannel[] = [];
    latestPerChannel.forEach((meta, channelId) => {
      // Never notify the user about their own messages — Home would
      // light up with a "new chat" every time you sent something.
      if (meta.authorId === user.id) return;
      const lastRead = readMap.get(channelId);
      const isUnread = !lastRead || new Date(meta.createdAt) > new Date(lastRead);
      if (!isUnread) return;
      const name = nameById.get(channelId);
      if (!name) return;
      result.push({ id: channelId, name, lastMessageAt: meta.createdAt });
    });

    // Sort newest-unread first so the Home banner picks the freshest
    // channel for the single-channel headline.
    result.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    setUnreadChannels(result);
  }, [user]);

  const refresh = useCallback(() => {
    // Lightweight throttle — don't refetch more than once per second.
    if (Date.now() - lastFetchAtRef.current < 1000) return;
    void fetchNow();
  }, [fetchNow]);

  useEffect(() => {
    void fetchNow();
    if (!user) return;
    const t = setInterval(fetchNow, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchNow, user]);

  return { unreadChannels, refresh };
}
