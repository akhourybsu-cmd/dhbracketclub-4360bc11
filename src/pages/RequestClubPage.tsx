import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStatus, type ClubRequest } from '@/hooks/useOnboardingStatus';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

import {
  ScrollText, Clock, Check, X, LogOut, ArrowRight, AlertCircle,
  Sparkles, MessageCircle,
} from 'lucide-react';

const STEPS = [
  { key: 'account', label: 'Account created' },
  { key: 'submitted', label: 'Access requested' },
  { key: 'review', label: 'Awaiting approval' },
  { key: 'welcome', label: "You're in" },
] as const;

function ProgressTracker({ active }: { active: number }) {
  return (
    <ol className="space-y-2.5">
      {STEPS.map((s, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={s.key} className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors"
              style={{
                background: done
                  ? 'hsl(var(--primary) / 0.18)'
                  : current
                    ? 'hsl(var(--gold) / 0.18)'
                    : 'hsl(var(--muted) / 0.4)',
                color: done
                  ? 'hsl(var(--primary))'
                  : current
                    ? 'hsl(var(--gold))'
                    : 'hsl(var(--muted-foreground))',
                border: current ? '1px solid hsl(var(--gold) / 0.4)' : '1px solid transparent',
              }}
            >
              {done ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span
              className={`text-sm ${done ? 'text-foreground' : current ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function activeStep(status: ClubRequest['status'] | 'no_request' | 'approved'): number {
  if (status === 'approved') return 4;
  if (status === 'no_request') return 1;
  if (status === 'rejected') return 1; // back to "request access"
  return 2; // pending or needs_info → awaiting approval
}

export default function RequestClubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state, request, refresh, loading } = useOnboardingStatus();

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clubName, setClubName] = useState<string>('the club');

  // Fetch the single club's name for friendly copy (prospects can't read the
  // clubs table directly under RLS — this SECURITY DEFINER reader exposes only
  // public branding).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any).rpc('get_primary_club');
      const row = Array.isArray(data) ? data[0] : data;
      if (!cancelled && row?.name) setClubName(row.name);
    })();
    return () => { cancelled = true; };
  }, []);

  // Hydrate the note field when an existing request loads.
  useEffect(() => {
    if (request) setNote(request.user_note ?? '');
  }, [request]);

  const submitRequest = async () => {
    setSubmitting(true);
    const { error } = await supabase.rpc('request_club_access', { _note: note });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? 'Could not send request');
      return false;
    }
    await refresh();
    return true;
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitRequest();
    if (ok) toast.success('Request sent! An admin will review it soon.');
  };

  const handleSendReply = async () => {
    const ok = await submitRequest();
    if (ok) toast.success('Reply sent — your request is back in the queue.');
  };

  const handleResubmit = async () => {
    const ok = await submitRequest();
    if (ok) toast.success('Request resent!');
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this request? You can send a new one anytime.')) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('cancel_club_request');
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Request cancelled');
    setNote('');
    await refresh();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner-ring" />
      </div>
    );
  }

  const step = activeStep(state === 'approved' ? 'approved' : state === 'no_request' ? 'no_request' : (request?.status ?? 'no_request'));

  return (
    <div
      className="min-h-screen bg-background px-4 py-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md mx-auto space-y-5"
      >
        {/* Header */}
        <div className="text-center pt-2">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.04))',
              border: '1px solid hsl(var(--primary) / 0.28)',
            }}
          >
            <ScrollText className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">
            {state === 'approved' && "You're in!"}
            {state === 'pending' && 'Request Sent'}
            {state === 'needs_info' && 'A bit more info needed'}
            {state === 'rejected' && 'Request Not Approved'}
            {state === 'no_request' && `Request access to ${clubName}`}
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            {state === 'approved' && `Welcome to ${clubName}. Head in whenever you’re ready.`}
            {state === 'pending' && 'Hang tight — an admin reviews each request personally. No need to send it again.'}
            {state === 'needs_info' && 'An admin left a note. Reply below and we’ll move you back into the queue.'}
            {state === 'rejected' && 'You can send another request below.'}
            {state === 'no_request' && `${clubName} is invite-only. Send a request and an admin will let you in.`}
          </p>
        </div>

        {/* Progress tracker */}
        <div className="glass-card p-4">
          <ProgressTracker active={step} />
        </div>

        {/* Approved */}
        {state === 'approved' && (
          <div className="space-y-3">
            <div className="glass-card p-4 flex items-start gap-3" style={{ borderColor: 'hsl(var(--primary) / 0.3)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.14)' }}>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">Welcome aboard</p>
                <p className="text-xs text-muted-foreground mt-0.5">You've been approved. Enjoy.</p>
              </div>
            </div>
            <Button onClick={() => navigate('/dashboard', { replace: true })} className="w-full h-11 font-bold rounded-xl btn-press gap-2">
              Enter the app <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Pending / needs-info */}
        {(state === 'pending' || state === 'needs_info') && request && (
          <>
            {state === 'needs_info' && request.review_notes && (
              <div className="glass-card p-4 flex items-start gap-3" style={{ borderColor: 'hsl(var(--gold) / 0.35)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--gold) / 0.16)' }}>
                  <MessageCircle className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'hsl(var(--gold))' }}>Note from the admin</p>
                  <p className="text-sm mt-1 leading-relaxed">{request.review_notes}</p>
                </div>
              </div>
            )}

            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-flex items-center gap-1"
                  style={{ background: 'hsl(var(--gold) / 0.16)', color: 'hsl(var(--gold))' }}
                >
                  <Clock className="w-3 h-3" />
                  {state === 'pending' ? 'Pending' : 'Needs info'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Updated {new Date(request.updated_at).toLocaleString()}
                </span>
              </div>

              {state === 'needs_info' ? (
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Your reply</label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Answer the question above…"
                      className="form-input resize-none"
                    />
                  </div>
                  <Button onClick={handleSendReply} disabled={submitting} className="w-full btn-press">
                    {submitting ? 'Sending…' : 'Send reply'}
                  </Button>
                </div>
              ) : (
                <>
                  {request.user_note && (
                    <div>
                      <p className="form-label">Your note</p>
                      <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 break-words">{request.user_note}</p>
                    </div>
                  )}
                  <Button variant="outline" onClick={handleCancel} disabled={submitting} className="w-full btn-press">
                    Cancel request
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {/* Rejected */}
        {state === 'rejected' && request && (
          <>
            <div className="glass-card p-4 flex items-start gap-3" style={{ borderColor: 'hsl(var(--destructive) / 0.3)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--destructive) / 0.14)' }}>
                <X className="w-4 h-4 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">Not approved</p>
                {request.review_notes ? (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{request.review_notes}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">No reason was provided.</p>
                )}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void handleResubmit(); }} className="glass-card p-5 space-y-4">
              <p className="text-[11px] text-muted-foreground/80 px-0.5 leading-relaxed flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Add anything that might help and send another request.
              </p>
              <div>
                <label className="form-label">Note to the admin (optional)</label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="form-input resize-none" />
              </div>
              <Button type="submit" className="w-full h-11 font-bold rounded-xl btn-press" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send request again'}
              </Button>
            </form>
          </>
        )}

        {/* No request yet */}
        {state === 'no_request' && (
          <form onSubmit={handleRequest} className="glass-card p-5 space-y-4">
            <div>
              <label className="form-label">Note to the admin (optional)</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Who are you? Add anything that helps the admin recognize you."
                maxLength={500}
                rows={4}
                className="form-input resize-none"
              />
            </div>
            <Button type="submit" className="w-full h-11 font-bold rounded-xl btn-press" disabled={submitting}>
              {submitting ? 'Sending…' : 'Request access'}
            </Button>
          </form>
        )}

        {/* Footer actions */}
        {state !== 'approved' && (
          <button
            onClick={handleSignOut}
            className="w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 py-2 btn-press"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        )}
      </motion.div>
    </div>
  );
}
