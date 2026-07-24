// Personal/actionable chat push helpers.
// Kept narrow on purpose: only targeted fan-outs (never broadcast). Sender
// exclusion + dedupe is enforced here AND server-side in
// send-push-notification as defense-in-depth.

import { supabase } from '@/integrations/supabase/client';

/**
 * Notify the original message author when someone reacts to their message.
 * Self-reactions are skipped. Per-message tag groups bursts on device.
 */
export async function notifyReaction(params: {
  messageId: string;
  channelId: string;
  authorId: string;
  reactorId: string;
  reactorDisplayName: string;
  emoji: string;
}) {
  const { messageId, channelId, authorId, reactorId, reactorDisplayName, emoji } = params;
  if (!authorId || authorId === reactorId) return;

  await supabase.functions.invoke('send-push-notification', {
    body: {
      type: 'reaction',
      title: `${reactorDisplayName} reacted ${emoji}`,
      message: 'to your message',
      tag: `dh-react-${messageId}`,
      url: `/chat?channel=${channelId}&message=${messageId}`,
      sender_user_id: reactorId,
      target_user_ids: [authorId],
    },
  }).catch(() => {});
}
