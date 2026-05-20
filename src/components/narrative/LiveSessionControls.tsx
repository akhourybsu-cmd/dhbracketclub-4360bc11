// DH Club — Narrative RPG · Live session controls
//
// Compact GM toolbar for starting/ending a live session. Renders a Live
// Now indicator + session duration ticker. Uses the existing
// campaign.live_session_id and campaign.live_started_at columns.
//
// On start: stamps live_session_id (a fresh uuid) + live_started_at, and
// posts a "Live session started" system message into the story chat so
// async players see when the live action begins.
// On end: clears the live fields and posts an "End of live session"
// system message. Optionally opens the SceneSummaryWizard so the GM can
// summarize on the spot.

import { useCallback, useEffect, useState } from 'react';
import { Radio, StopCircle, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { StatusPill } from '@/components/ui/status-pill';
import { SceneSummaryWizard } from './SceneSummaryWizard';
import type { Campaign, Scene } from '@/lib/narrative/types';

interface Props {
  campaign: Campaign;
  currentScene: Scene | null;
  /** Caller refreshes data after the campaign row mutates. */
  onChanged?: () => void;
  /** Compact mode hides the GM controls and shows only the live pill. */
  compact?: boolean;
  /** Hide the buttons entirely (for non-GM viewers). */
  readOnly?: boolean;
}

export function LiveSessionControls({ campaign, currentScene, onChanged, compact, readOnly }: Props) {
  const isLive = !!campaign.live_session_id && !!campaign.live_started_at;
  const [busy, setBusy] = useState(false);
  const [summarizeOpen, setSummarizeOpen] = useState(false);

  // Tick once a minute so the duration display updates without a full re-fetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => setTick(x => x + 1), 60_000);
    return () => clearInterval(t);
  }, [isLive]);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      // Use crypto for a stable session id we can later track sessions by.
      const sessionId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { error } = await (supabase as any).from('narrative_campaigns')
        .update({ live_session_id: sessionId, live_started_at: now })
        .eq('id', campaign.id);
      if (error) {
        toast.error(`Couldn't start: ${error.message}`);
        return;
      }
      const { data: claims } = await supabase.auth.getUser();
      await (supabase as any).from('narrative_messages').insert({
        campaign_id: campaign.id,
        scene_id: currentScene?.id ?? null,
        sender_id: claims.user?.id ?? null,
        message_type: 'system',
        body: 'Live session started.',
        visibility: 'public',
        metadata: { live_session_id: sessionId, started_at: now },
      });
      toast.success('Live session started.');
      onChanged?.();
    } catch (e) {
      toast.error(`Couldn't start: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      // Always clear so the Start button never sticks in loading.
      setBusy(false);
    }
  }, [campaign.id, currentScene?.id, onChanged]);

  const end = useCallback(async () => {
    setBusy(true);
    try {
      const startedAt = campaign.live_started_at;
      const { error } = await (supabase as any).from('narrative_campaigns')
        .update({ live_session_id: null, live_started_at: null })
        .eq('id', campaign.id);
      if (error) {
        toast.error(`Couldn't end: ${error.message}`);
        return;
      }
      const { data: claims } = await supabase.auth.getUser();
      await (supabase as any).from('narrative_messages').insert({
        campaign_id: campaign.id,
        scene_id: currentScene?.id ?? null,
        sender_id: claims.user?.id ?? null,
        message_type: 'system',
        body: 'End of live session.',
        visibility: 'public',
        metadata: { started_at: startedAt, ended_at: new Date().toISOString() },
      });
      toast.success('Live session ended.');
      onChanged?.();
      // Offer to summarize the session.
      setSummarizeOpen(true);
    } catch (e) {
      toast.error(`Couldn't end: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  }, [campaign.id, campaign.live_started_at, currentScene?.id, onChanged]);

  const duration = isLive ? formatDuration(campaign.live_started_at!) : null;

  if (!isLive && readOnly) return null;
  if (!isLive && compact) return null;

  return (
    <>
      <div className={`inline-flex items-center gap-2 ${compact ? '' : 'flex-wrap'}`}>
        {isLive && (
          <StatusPill variant="live" size="sm" dot pulse>
            Live Now{duration ? ` · ${duration}` : ''}
          </StatusPill>
        )}
        {!readOnly && (
          isLive ? (
            <button
              type="button"
              onClick={end}
              disabled={busy}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[11px] font-extrabold uppercase tracking-wider bg-destructive/15 border border-destructive/40 text-destructive active:scale-95 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />} End session
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[11px] font-extrabold uppercase tracking-wider active:scale-95 disabled:opacity-50"
              style={{ background: 'hsl(var(--success) / 0.18)', color: 'hsl(var(--success))', border: '1px solid hsl(var(--success) / 0.4)' }}
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />} Start live
            </button>
          )
        )}
      </div>
      <SceneSummaryWizard
        open={summarizeOpen}
        onClose={() => setSummarizeOpen(false)}
        campaign={campaign}
        currentScene={currentScene}
        onApplied={onChanged}
      />
    </>
  );
}

function formatDuration(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return '0m';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}
