// DH Club — Club-scoped online presence hook
//
// Wraps the same Supabase presence channel that MembersOnline uses
// (`online-presence:${clubId}`, keyed by user.id) and exposes the set
// of currently-online user IDs. This lets multiple surfaces (Home
// strip, chat avatar dots, etc.) share one truth without each
// opening its own channel.
//
// The presence join is per-mount: the first hook instance to mount
// in the session joins the channel and tracks the current user;
// subsequent instances on the same `clubId` re-use the same data via
// the Supabase channel's own dedup. That said, having multiple
// subscribers is cheap and works correctly — Supabase only opens one
// WebSocket per channel name regardless of how many subscribers join.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';

interface PresenceMeta {
  user_id: string;
  display_name?: string;
  avatar_url?: string | null;
}

interface UseClubPresenceOptions {
  /** Optional display name to broadcast as part of this user's
   *  presence. If omitted, no display_name is tracked (other hooks
   *  that need the name should pass it in). */
  displayName?: string;
  /** Optional avatar URL to broadcast. */
  avatarUrl?: string | null;
  /** Set false to skip tracking — useful when this hook is called in
   *  a context where the user's presence shouldn't count (admin
   *  surfaces viewing other clubs, etc.). Defaults to true. */
  track?: boolean;
}

interface UseClubPresenceResult {
  /** Set of user IDs currently online in the user's active club. */
  onlineIds: Set<string>;
  /** Full presence rows for surfaces that want display_name/avatar. */
  users: PresenceMeta[];
}

export function useClubPresence(opts: UseClubPresenceOptions = {}): UseClubPresenceResult {
  const { user } = useAuth();
  const { club } = useClub();
  const [users, setUsers] = useState<PresenceMeta[]>([]);
  const { displayName, avatarUrl, track = true } = opts;

  useEffect(() => {
    if (!user || !club?.id) return;
    const channel = supabase.channel(
      `online-presence:${club.id}`,
      { config: { presence: { key: user.id } } },
    );

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const flat = Object.values(state).flat().map((p: any) => ({
          user_id: p.user_id as string,
          display_name: p.display_name as string | undefined,
          avatar_url: p.avatar_url as string | null | undefined,
        }));
        // Dedupe across devices for a single user.
        const seen = new Set<string>();
        setUsers(flat.filter(u => seen.has(u.user_id) ? false : (seen.add(u.user_id), true)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && track) {
          await channel.track({
            user_id: user.id,
            display_name: displayName,
            avatar_url: avatarUrl,
          });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, club?.id, displayName, avatarUrl, track]);

  const onlineIds = useMemo(() => new Set(users.map(u => u.user_id)), [users]);
  return { onlineIds, users };
}
