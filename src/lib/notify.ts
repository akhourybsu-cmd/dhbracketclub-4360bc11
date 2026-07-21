// Unified client-side push notification helper.
// All client triggers should go through `notify()` so we get consistent
// payload shape, tag-coalescing, and silent failure (never blocks user
// action). The edge function enforces preferences, throttle, and active-
// viewer suppression — clients just describe the event.

import { supabase } from '@/integrations/supabase/client';

export type NotifyType =
  | 'poll'
  | 'event'
  | 'draft'
  | 'lockbox'
  | 'thread_reply'
  | 'reaction'
  | 'portfolio_wars'
  | 'pickem'
  | 'rankings'
  | 'posts'
  | 'lore'
  | 'celebrations'
  | 'narrative'
  | 'brackets'
  | 'nexus'
  | 'runedelve'
  | 'readshift'
  | 'system';

export interface NotifyParams {
  type: NotifyType;
  title: string;
  message?: string;
  url?: string;
  /** Tag for SW coalescing. Convention: `dh-<type>-<entityId>`. */
  tag?: string;
  /** Sender uid (always excluded from recipients server-side). */
  senderUserId?: string;
  /** Single recipient. */
  targetUserId?: string;
  /** Multi recipient fan-out (deduped server-side). */
  targetUserIds?: string[];
}

/**
 * Fire-and-forget push. Always swallows errors so callers never break
 * because of a delivery hiccup.
 */
export async function notify(params: NotifyParams): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        type: params.type,
        title: params.title,
        message: params.message ?? '',
        url: params.url ?? '/',
        tag: params.tag ?? `dh-${params.type}`,
        sender_user_id: params.senderUserId,
        target_user_id: params.targetUserId,
        target_user_ids: params.targetUserIds,
      },
    });
  } catch {
    /* swallow — push failures must never block UX */
  }
}
