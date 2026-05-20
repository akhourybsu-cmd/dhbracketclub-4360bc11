// DH Club — Narrative RPG · Invite Accept/Decline banner
//
// Renders on the campaign detail page when the viewer has an
// outstanding invitation (narrative_campaign_members row with
// status='invited'). Accept flips status to 'active' and refreshes
// the campaign hook. Decline flips to 'removed' (same as a manual
// remove — the GM can re-invite later).

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { CampaignMember } from '@/lib/narrative/types';

interface Props {
  invitation: CampaignMember;
  campaignTitle: string;
  onResponded?: () => void;
}

const ROLE_LABEL: Record<CampaignMember['role'], string> = {
  game_master: 'Game Master',
  player: 'Player',
  spectator: 'Spectator',
};

export function InviteRsvpBanner({ invitation, campaignTitle, onResponded }: Props) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const respond = async (decision: 'accept' | 'decline') => {
    setBusy(decision);
    try {
      const nextStatus = decision === 'accept' ? 'active' : 'removed';
      const { error } = await (supabase as any)
        .from('narrative_campaign_members')
        .update({ status: nextStatus, joined_at: decision === 'accept' ? new Date().toISOString() : invitation.joined_at })
        .eq('id', invitation.id);
      if (error) {
        toast.error(`Couldn't respond: ${error.message}`);
        return;
      }
      toast.success(decision === 'accept' ? `Joined as ${ROLE_LABEL[invitation.role]}.` : 'Invite declined.');
      onResponded?.();
    } catch (e) {
      toast.error(`Couldn't respond: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      // Always clear — fixes the permanent-loading bug where a thrown
      // error left both Accept/Decline buttons disabled forever.
      setBusy(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-3 rounded-2xl border border-primary/40 p-3.5"
      style={{ background: 'hsl(var(--primary) / 0.08)' }}
    >
      <div className="flex items-start gap-2">
        <UserPlus className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(var(--primary))' }}>
            You're invited
          </p>
          <p className="text-[12.5px] font-extrabold tracking-tight mt-0.5">{campaignTitle}</p>
          <p className="text-[11px] text-muted-foreground/85 leading-snug mt-0.5">
            The Game Master invited you to join as <span className="font-extrabold text-foreground/85">{ROLE_LABEL[invitation.role]}</span>.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => respond('decline')}
          disabled={!!busy}
          className="h-10 rounded-xl text-[12px] font-extrabold bg-muted/40 border border-border/40 text-foreground/80 inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
        >
          {busy === 'decline' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          Decline
        </button>
        <button
          type="button"
          onClick={() => respond('accept')}
          disabled={!!busy}
          className="h-10 rounded-xl text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}
        >
          {busy === 'accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Accept
        </button>
      </div>
    </motion.div>
  );
}
