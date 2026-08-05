import { useEffect, useMemo, useState } from 'react';
import { Check, Hash, Loader2, Megaphone, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { buildDraftInviteMessage } from '@/lib/draftInvite';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Channel } from '@/components/chat/types';

interface DraftChannelInviteButtonProps {
  draftId: string;
  topic: string;
  rounds: number;
  participantCount: number;
  className?: string;
}

export function DraftChannelInviteButton({
  draftId,
  topic,
  rounds,
  participantCount,
  className,
}: DraftChannelInviteButtonProps) {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { isInstalled } = useClubAssets();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [postingTo, setPostingTo] = useState<string | null>(null);
  const [postedTo, setPostedTo] = useState<string | null>(null);

  const chatAvailable = isInstalled('chat');
  const visibleChannels = useMemo(() => channels.filter(channel => {
    if (channel.club_id !== club?.id || channel.archived_at) return false;
    if (channel.channel_type === 'admin_only' && !isClubAdmin) return false;
    if (channel.post_permission === 'admins' && !isClubAdmin) return false;
    return true;
  }), [channels, club?.id, isClubAdmin]);

  useEffect(() => {
    if (!open || !club?.id) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('channels')
      .select('*')
      .eq('club_id', club.id)
      .is('archived_at', null)
      .order('position')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error('Could not load chat channels');
        setChannels((data as Channel[] | null) ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, club?.id]);

  const postInvite = async (channel: Channel) => {
    if (!user || postingTo) return;
    setPostingTo(channel.id);
    const content = buildDraftInviteMessage({ draftId, topic, rounds, participantCount });
    const { data, error } = await (supabase as any)
      .from('messages')
      .insert({ channel_id: channel.id, user_id: user.id, content })
      .select('id, channel_id, user_id, content')
      .single();

    if (error || !data) {
      toast.error(error?.message || 'Could not post draft invite');
      setPostingTo(null);
      return;
    }

    setPostedTo(channel.id);
    toast.success(`Invite posted to #${channel.name}`);
    supabase.functions.invoke('send-push-notification', { body: { record: data } }).catch(() => {});
    window.setTimeout(() => {
      setOpen(false);
      setPostingTo(null);
      setPostedTo(null);
    }, 550);
  };

  if (!chatAvailable) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={className}
        title="Share draft to chat"
        aria-label="Share draft to chat"
      >
        <Share2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/50 p-5 pr-12 text-left">
            <DialogTitle>Post draft invite</DialogTitle>
            <DialogDescription>Choose a channel. The invite posts immediately.</DialogDescription>
          </DialogHeader>

          <div className="border-b border-border/40 bg-secondary/30 px-5 py-4">
            <p className="text-[10px] font-bold uppercase text-primary">Draft Arena</p>
            <p className="mt-1 break-words text-sm font-extrabold leading-snug">{topic}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rounds} rounds • {participantCount} joined</p>
          </div>

          <div className="max-h-[min(48vh,22rem)] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading channels
              </div>
            ) : visibleChannels.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">No channels are available for posting.</p>
            ) : visibleChannels.map(channel => {
              const Icon = channel.channel_type === 'announcements' ? Megaphone : Hash;
              const isPosting = postingTo === channel.id;
              const isPosted = postedTo === channel.id;
              return (
                <Button
                  key={channel.id}
                  type="button"
                  variant="ghost"
                  disabled={postingTo !== null}
                  onClick={() => postInvite(channel)}
                  className="h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {channel.icon && channel.icon !== 'hash' ? channel.icon : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-bold leading-tight">{channel.name}</span>
                    {channel.description && <span className="mt-0.5 block break-words text-[11px] font-normal text-muted-foreground">{channel.description}</span>}
                  </span>
                  {isPosting && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {isPosted && <Check className="h-4 w-4 text-primary" />}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}