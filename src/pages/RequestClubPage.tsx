import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStatus, type ClubRequest } from '@/hooks/useOnboardingStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { JoinClubWithPasswordCard } from '@/components/onboarding/JoinClubWithPasswordCard';

import {
  ScrollText, Clock, Check, X, LogOut, ArrowRight, AlertCircle,
  Sparkles, Pencil, MessageCircle,
} from 'lucide-react';

const STEPS = [
  { key: 'account', label: 'Account created' },
  { key: 'submitted', label: 'Request submitted' },
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
  if (status === 'rejected') return 1; // back to step "submit"
  return 2; // pending or needs_info → awaiting approval
}

export default function RequestClubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state, request, refresh, loading } = useOnboardingStatus();

  const [proposedName, setProposedName] = useState('');
  const [reason, setReason] = useState('');
  const [userNote, setUserNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  // Hydrate fields when a request is loaded
  useEffect(() => {
    if (request) {
      setProposedName(request.proposed_name);
      setReason(request.reason ?? '');
      setUserNote(request.user_note ?? '');
    }
  }, [request]);

  const callUpsert = async (next: { name: string; reason: string; note: string }) => {
    setSubmitting(true);
    const { error } = await (supabase as any).rpc('upsert_club_request', {
      _proposed_name: next.name,
      _reason: next.reason,
      _user_note: next.note,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? 'Could not save request');
      return false;
    }
    await refresh();
    return true;
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedName.trim()) {
      toast.error('Please enter a club name');
      return;
    }
    const ok = await callUpsert({ name: proposedName, reason, note: userNote });
    if (ok) toast.success('Request submitted! Alex will review it soon.');
  };

  const handleSendUpdate = async () => {
    const ok = await callUpsert({ name: proposedName, reason, note: userNote });
    if (ok) {
      toast.success('Update sent. Your request is back in the queue.');
      setEditing(false);
    }
  };

  const handleResubmit = async () => {
    if (!proposedName.trim()) { toast.error('Please enter a club name'); return; }
    const ok = await callUpsert({ name: proposedName, reason, note: userNote });
    if (ok) toast.success('New request submitted!');
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this request? You can submit a new one anytime.')) return;
    setSubmitting(true);
    const { error } = await (supabase as any).rpc('cancel_club_request');
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Request cancelled');
    setProposedName(''); setReason(''); setUserNote('');
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
            {state === 'pending' && 'Request Submitted'}
            {state === 'needs_info' && 'A bit more info needed'}
            {state === 'rejected' && 'Request Not Approved'}
            {state === 'no_request' && 'Request Club Access'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            {state === 'approved' && 'Your club is live. Head into the app whenever you’re ready.'}
            {state === 'pending' && 'Hang tight — Alex reviews each request manually. No need to submit again.'}
            {state === 'needs_info' && 'Alex left a note. Reply below and we’ll move you back into the queue.'}
            {state === 'rejected' && 'You can update your request and try again.'}
            {state === 'no_request' && 'Tell us about your club. Each one gets its own admin, members, and isolated data.'}
          </p>
        </div>

        {/* Progress tracker */}
        <div className="glass-card p-4">
          <ProgressTracker active={step} />
        </div>

        {/* Status-specific surfaces */}
        {state === 'approved' && (
          <div className="space-y-3">
            <div className="glass-card p-4 flex items-start gap-3" style={{ borderColor: 'hsl(var(--primary) / 0.3)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.14)' }}>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">Welcome aboard</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your club is set up and ready.</p>
              </div>
            </div>
            <Button onClick={() => navigate('/dashboard', { replace: true })} className="w-full h-11 font-bold rounded-xl btn-press gap-2">
              Enter the app <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {(state === 'pending' || state === 'needs_info') && request && (
          <>
            {state === 'needs_info' && request.review_notes && (
              <div className="glass-card p-4 flex items-start gap-3" style={{ borderColor: 'hsl(var(--gold) / 0.35)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--gold) / 0.16)' }}>
                  <MessageCircle className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'hsl(var(--gold))' }}>Note from Alex</p>
                  <p className="text-sm mt-1 leading-relaxed">{request.review_notes}</p>
                </div>
              </div>
            )}

            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-flex items-center gap-1"
                  style={{
                    background: state === 'pending' ? 'hsl(var(--gold) / 0.16)' : 'hsl(var(--gold) / 0.16)',
                    color: 'hsl(var(--gold))',
                  }}
                >
                  <Clock className="w-3 h-3" />
                  {state === 'pending' ? 'Pending' : 'Needs info'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Updated {new Date(request.updated_at).toLocaleString()}
                </span>
              </div>

              {!editing ? (
                <>
                  <div>
                    <p className="form-label">Club name</p>
                    <p className="text-base font-bold">{request.proposed_name}</p>
                  </div>
                  {request.reason && (
                    <div>
                      <p className="form-label">Why this club</p>
                      <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 break-words">{request.reason}</p>
                    </div>
                  )}
                  {request.user_note && (
                    <div>
                      <p className="form-label">Your latest note</p>
                      <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 break-words">{request.user_note}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Club name</label>
                    <Input value={proposedName} onChange={(e) => setProposedName(e.target.value)} maxLength={48} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Why this club</label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="form-input resize-none" />
                  </div>
                  {state === 'needs_info' && (
                    <div>
                      <label className="form-label">Your reply to Alex</label>
                      <Textarea
                        value={userNote}
                        onChange={(e) => setUserNote(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Answer the question above…"
                        className="form-input resize-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                {!editing ? (
                  <>
                    <Button variant="outline" onClick={() => setEditing(true)} className="btn-press gap-1.5">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button variant="outline" onClick={handleCancel} disabled={submitting} className="btn-press">
                      Cancel request
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setEditing(false)} className="btn-press">
                      Discard
                    </Button>
                    <Button onClick={handleSendUpdate} disabled={submitting} className="btn-press">
                      {submitting ? 'Saving…' : state === 'needs_info' ? 'Send update' : 'Save changes'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

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
                Update your details and resubmit — this will replace your previous request.
              </p>
              <div>
                <label className="form-label">Club name</label>
                <Input required value={proposedName} onChange={(e) => setProposedName(e.target.value)} maxLength={48} className="form-input" />
              </div>
              <div>
                <label className="form-label">Why this club (optional)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="form-input resize-none" />
              </div>
              <Button type="submit" className="w-full h-11 font-bold rounded-xl btn-press" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Resubmit request'}
              </Button>
            </form>
          </>
        )}
        {state !== 'approved' && (
          <JoinClubWithPasswordCard
            onJoined={async () => {
              await refresh();
              navigate('/dashboard', { replace: true });
            }}
          />
        )}


        {state === 'no_request' && (
          <form onSubmit={handleSubmitNew} className="glass-card p-5 space-y-4">
            <div>
              <label className="form-label">Proposed Club Name</label>
              <Input
                required
                value={proposedName}
                onChange={(e) => setProposedName(e.target.value)}
                placeholder="e.g. Smith Family"
                maxLength={48}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Why this club? (optional)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly tell Alex who's joining and what you'll use it for."
                maxLength={500}
                rows={4}
                className="form-input resize-none"
              />
            </div>
            <Button type="submit" className="w-full h-11 font-bold rounded-xl btn-press" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
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
