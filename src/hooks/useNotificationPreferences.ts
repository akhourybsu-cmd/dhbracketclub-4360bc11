import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationPreferences {
  chat_messages: boolean;
  polls: boolean;
  events: boolean;
  drafts: boolean;
  mentions: boolean;
  lockbox: boolean;
  portfolio_wars: boolean;
  pickem: boolean;
  rankings: boolean;
  posts: boolean;
  lore: boolean;
  celebrations: boolean;
  narrative: boolean;
  brackets: boolean;
  nexus: boolean;
  runedelve: boolean;
  system: boolean;
}

const DEFAULTS: NotificationPreferences = {
  chat_messages: true,
  polls: true,
  events: true,
  drafts: true,
  mentions: true,
  lockbox: true,
  portfolio_wars: true,
  pickem: true,
  rankings: true,
  posts: true,
  lore: true,
  celebrations: true,
  narrative: true,
  brackets: true,
  nexus: true,
  runedelve: true,
  system: true,
};

const ALL_COLS =
  'chat_messages, polls, events, drafts, mentions, lockbox, portfolio_wars, pickem, rankings, posts, lore, celebrations, narrative, brackets, nexus, runedelve, system';

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select(ALL_COLS)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setPrefs({ ...DEFAULTS, ...(data as Partial<NotificationPreferences>) });
      }
      setLoading(false);
    };
    fetchPrefs();
  }, [user]);

  const update = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      if (!user) return;
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);

      await supabase.from('notification_preferences').upsert(
        {
          user_id: user.id,
          ...updated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    },
    [user, prefs]
  );

  return { prefs, loading, update };
}
