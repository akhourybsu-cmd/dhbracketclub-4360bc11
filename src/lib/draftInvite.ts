import { generateShareLink } from '@/lib/share';

export const DRAFT_INVITE_MARKER = '🏆 **Draft invite**';

export function buildDraftInviteMessage({
  draftId,
  topic,
  rounds,
  participantCount,
}: {
  draftId: string;
  topic: string;
  rounds: number;
  participantCount: number;
}): string {
  const link = generateShareLink('draft', draftId);
  const playerLabel = participantCount === 1 ? 'player joined' : 'players joined';
  return [
    DRAFT_INVITE_MARKER,
    `**${topic}**`,
    `${rounds} rounds • ${participantCount} ${playerLabel}`,
    'Tap below to join the draft.',
    link,
  ].join('\n');
}

export function getDraftIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/drafts\/([0-9a-f-]{36})\/?$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}