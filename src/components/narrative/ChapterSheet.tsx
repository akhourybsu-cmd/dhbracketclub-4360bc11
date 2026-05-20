// DH Club — Narrative RPG · Chapter management
//
// GM-only sheet to create, edit, and transition between chapters. A
// chapter is the highest-level organizational unit in a campaign — it
// groups scenes together and shows up in the campaign log via the
// `chapter_transition` message type.
//
// Behavior:
//   • Creating a new chapter optionally marks it current (posts a
//     chapter_transition system message to story chat).
//   • Editing an existing chapter only updates title/description.
//   • "Make current" on an existing chapter posts a transition too.
//   • Status: upcoming → active → completed.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Bookmark, PlusCircle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusPill } from '@/components/ui/status-pill';
import type { Campaign } from '@/lib/narrative/types';

interface Chapter {
  id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  status: 'upcoming' | 'active' | 'completed';
  position: number;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  onChanged?: () => void;
}

export function ChapterSheet({ open, onClose, campaign, onChanged }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('narrative_chapters')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('position', { ascending: true });
    setLoading(false);
    if (error) { toast.error('Failed to load chapters.'); return; }
    setChapters((data ?? []) as Chapter[]);
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open, campaign.id]);

  const startNew = () => { setEditing({ id: '', campaign_id: campaign.id, title: '', description: null, status: 'upcoming', position: chapters.length, created_at: '' }); setTitle(''); setDescription(''); };
  const startEdit = (c: Chapter) => { setEditing(c); setTitle(c.title); setDescription(c.description ?? ''); };
  const cancel = () => { setEditing(null); setTitle(''); setDescription(''); };

  const save = async () => {
    if (!editing) return;
    if (!title.trim()) { toast.error('Give the chapter a title.'); return; }
    setBusy(true);
    try {
      if (editing.id) {
        const { error } = await (supabase as any).from('narrative_chapters')
          .update({ title: title.trim(), description: description.trim() || null })
          .eq('id', editing.id);
        if (error) { toast.error(error.message); return; }
      } else {
        const { error } = await (supabase as any).from('narrative_chapters').insert({
          campaign_id: campaign.id,
          title: title.trim(),
          description: description.trim() || null,
          status: 'upcoming',
          position: editing.position,
        });
        if (error) { toast.error(error.message); return; }
      }
      toast.success('Saved.');
      cancel();
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const makeCurrent = async (c: Chapter) => {
    setBusy(true);
    try {
      // Mark any previously active chapter as completed.
      const { error: closeErr } = await (supabase as any).from('narrative_chapters')
        .update({ status: 'completed' })
        .eq('campaign_id', campaign.id)
        .eq('status', 'active');
      if (closeErr) toast.warning(`Couldn't close previous chapter: ${closeErr.message}`);

      const { error } = await (supabase as any).from('narrative_chapters')
        .update({ status: 'active' })
        .eq('id', c.id);
      if (error) { toast.error(error.message); return; }

      await (supabase as any).from('narrative_campaigns')
        .update({ current_chapter_id: c.id })
        .eq('id', campaign.id);

      // Post a chapter_transition message into the chat.
      const { data: claims } = await supabase.auth.getUser();
      await (supabase as any).from('narrative_messages').insert({
        campaign_id: campaign.id,
        sender_id: claims.user?.id ?? null,
        message_type: 'chapter_transition',
        body: c.title,
        visibility: 'public',
        metadata: { chapter_id: c.id, description: c.description },
      });

      toast.success('Chapter is now current.');
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error(`Chapter transition failed: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const complete = async (c: Chapter) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).from('narrative_chapters')
        .update({ status: 'completed' })
        .eq('id', c.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Chapter completed.');
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error(`Couldn't complete chapter: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[92dvh] rounded-t-2xl flex flex-col overflow-hidden bg-card border border-border/40"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/25">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-primary" />
            <h2 className="text-[14px] font-extrabold tracking-tight">Chapters</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {editing ? (
            <div className="rounded-xl bg-muted/25 border border-border/40 p-3 space-y-2">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">
                {editing.id ? 'Edit chapter' : 'New chapter'}
              </p>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Chapter title" className="h-10" />
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Chapter description (optional)" rows={3} className="text-[12px]" />
              <div className="flex gap-1.5">
                <button onClick={cancel} className="flex-1 h-9 rounded-md text-[11px] font-bold bg-muted/40 border border-border/40">Cancel</button>
                <button onClick={save} disabled={busy || !title.trim()} className="flex-1 h-9 rounded-md text-[11px] font-extrabold disabled:opacity-50" style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.35)' }}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin inline-block" /> : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={startNew} className="w-full h-10 rounded-xl text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5" style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.35)' }}>
              <PlusCircle className="w-3.5 h-3.5" /> New chapter
            </button>
          )}

          {loading && chapters.length === 0 && (
            <div className="text-center py-6"><Loader2 className="w-4 h-4 mx-auto animate-spin text-muted-foreground/70" /></div>
          )}
          {!loading && chapters.length === 0 && (
            <div className="rounded-xl bg-muted/25 border border-dashed border-border/40 p-3 text-center">
              <p className="text-[11.5px] text-muted-foreground/75">No chapters yet. Create one to start organizing the campaign arc.</p>
            </div>
          )}

          <div className="space-y-1.5">
            {chapters.map(c => (
              <div key={c.id} className={`rounded-xl border p-3 ${c.status === 'active' ? 'border-primary/40 bg-primary/8' : 'border-border/40 bg-card'}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12.5px] font-extrabold truncate">{c.title}</p>
                      <StatusPill variant={c.status === 'active' ? 'success' : c.status === 'completed' ? 'info' : 'neutral'} size="xs">
                        {c.status}
                      </StatusPill>
                    </div>
                    {c.description && <p className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">{c.description}</p>}
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => startEdit(c)} disabled={busy} className="flex-1 h-8 rounded-md text-[10.5px] font-bold bg-muted/40 border border-border/40 active:scale-95 disabled:opacity-50">
                    Edit
                  </button>
                  {c.status !== 'active' && c.status !== 'completed' && (
                    <button onClick={() => makeCurrent(c)} disabled={busy} className="flex-1 h-8 rounded-md text-[10.5px] font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-50" style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.35)' }}>
                      <Check className="w-3 h-3" /> Make current
                    </button>
                  )}
                  {c.status === 'active' && (
                    <button onClick={() => complete(c)} disabled={busy} className="flex-1 h-8 rounded-md text-[10.5px] font-extrabold bg-muted/40 border border-border/40 active:scale-95 disabled:opacity-50">
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
