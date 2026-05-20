// DH Club — Narrative RPG · Club Settings approval panel
//
// Mounts in ClubSettingsPage when the plugin is installed. Shows the
// pending-approval queue for club admins; approving / requesting
// changes / rejecting flows through the shared hook (audited).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScrollText, Check, X, MessageSquareWarning, ChevronRight } from 'lucide-react';
import { useNarrativeCampaigns } from '@/hooks/useNarrativeCampaigns';
import { CampaignStatusPill } from './CampaignStatusPill';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getTemplate } from '@/lib/narrative/templates';

interface Props {
  installed: boolean;
  isAdmin: boolean;
}

export function NarrativeApprovalsPanel({ installed, isAdmin }: Props) {
  const { campaigns, approveCampaign, requestChanges, rejectCampaign, error: hookError } = useNarrativeCampaigns();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (!installed || !isAdmin) return null;

  const pending = campaigns.filter(c => c.status === 'pending_approval');

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card p-5 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 flex items-center gap-1.5">
          <ScrollText className="w-3 h-3" /> Narrative Campaigns
          {pending.length > 0 && (
            <span className="ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-warning/15 text-warning">
              {pending.length}
            </span>
          )}
        </h2>
        <Link to="/narrative" className="text-[10px] font-bold text-muted-foreground/60 hover:text-foreground inline-flex items-center gap-0.5">
          Manage <ChevronRight className="w-2.5 h-2.5" />
        </Link>
      </div>

      {pending.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/70 py-2">No campaigns waiting for review.</p>
      ) : (
        <div className="space-y-2">
          {pending.map(c => {
            const template = getTemplate(c.template_key);
            const isExpanded = activeId === c.id;
            return (
              <div key={c.id} className="rounded-xl border border-border/30 bg-muted/15 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-extrabold leading-tight line-clamp-2 break-words flex-1 min-w-0">{c.title}</span>
                      <CampaignStatusPill status={c.status} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65 mt-0.5">
                      {template.name} · {c.play_mode}
                    </p>
                    {c.pitch && <p className="text-[11.5px] text-foreground/85 leading-snug mt-1.5">{c.pitch}</p>}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {c.opening_premise && (
                      <div>
                        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">Premise</p>
                        <p className="text-[11.5px] text-foreground/80 leading-snug mt-0.5 whitespace-pre-wrap">{c.opening_premise}</p>
                      </div>
                    )}
                    {c.content_notes && (
                      <div>
                        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">Content notes</p>
                        <p className="text-[11.5px] text-foreground/80 leading-snug mt-0.5 whitespace-pre-wrap">{c.content_notes}</p>
                      </div>
                    )}
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Admin notes (optional for approve, required for reject/changes)"
                      rows={2}
                      className="text-[12px]"
                    />
                  </div>
                )}

                <div className="mt-2.5 flex items-center gap-1.5">
                  {isExpanded ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const ok = await rejectCampaign(c.id, notes);
                            if (!ok) { toast.error(hookError ?? 'Reject failed.'); return; }
                            setActiveId(null); setNotes(''); toast.success('Rejected.');
                          } catch (e) {
                            toast.error(`Reject failed: ${(e as Error).message ?? 'unknown error'}`);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="flex-1 h-8 rounded-md text-[10.5px] font-bold inline-flex items-center justify-center gap-1 bg-destructive/12 text-destructive border border-destructive/25 disabled:opacity-50"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                      <button
                        type="button"
                        disabled={busy || !notes.trim()}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const ok = await requestChanges(c.id, notes);
                            if (!ok) { toast.error(hookError ?? 'Request changes failed.'); return; }
                            setActiveId(null); setNotes(''); toast.success('Changes requested.');
                          } catch (e) {
                            toast.error(`Request changes failed: ${(e as Error).message ?? 'unknown error'}`);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="flex-1 h-8 rounded-md text-[10.5px] font-bold inline-flex items-center justify-center gap-1 bg-warning/12 text-warning border border-warning/25 disabled:opacity-50"
                      >
                        <MessageSquareWarning className="w-3 h-3" /> Request changes
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const ok = await approveCampaign(c.id, notes || undefined);
                            if (!ok) { toast.error(hookError ?? 'Approve failed.'); return; }
                            setActiveId(null); setNotes(''); toast.success('Approved.');
                          } catch (e) {
                            toast.error(`Approve failed: ${(e as Error).message ?? 'unknown error'}`);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="flex-1 h-8 rounded-md text-[10.5px] font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                        style={{ background: 'hsl(var(--success) / 0.18)', color: 'hsl(var(--success))', border: '1px solid hsl(var(--success) / 0.35)' }}
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setActiveId(c.id); setNotes(''); }}
                      className="w-full h-8 rounded-md text-[11px] font-bold bg-muted/40 border border-border/40 text-foreground/85"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
