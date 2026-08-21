import { useEffect, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Shield, Check, X, ArrowLeft, MessageCircle, UserPlus } from 'lucide-react';

type Request = {
  id: string;
  requested_by: string;
  proposed_name: string;
  reason: string | null;
  user_note?: string | null;
  status: string;
  created_at: string;
  profile?: { display_name: string };
};

/**
 * Membership approval queue for the single club. Prospective members sign up
 * and request access (request_club_access); an admin approves them here, which
 * adds them to the club via the approve_join_request RPC. There is no club
 * creation or multi-club management anymore.
 */
export default function AdminClubsPage() {
  const { isPlatformOwner, isAppAdmin, loading: clubLoading } = useClub();
  const canReview = isPlatformOwner || isAppAdmin;
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: reqs } = await (supabase as any)
      .from('club_requests')
      .select('id, requested_by, proposed_name, reason, user_note, status, created_at, profile:requested_by(display_name)')
      .order('created_at', { ascending: false });
    if (reqs) setRequests(reqs as Request[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!clubLoading && canReview) void load();
  }, [clubLoading, canReview, load]);

  if (clubLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="loading-spinner-ring" /></div>;
  }
  if (!canReview) {
    return <Navigate to="/dashboard" replace />;
  }

  const approve = async (req: Request) => {
    setActingId(req.id);
    const { error } = await (supabase as any).rpc('approve_join_request', { _request_id: req.id });
    if (error) toast.error(error.message ?? 'Approval failed');
    else { toast.success(`${req.profile?.display_name ?? 'Member'} approved!`); await load(); }
    setActingId(null);
  };

  const reject = async (req: Request) => {
    setActingId(req.id);
    const { error } = await (supabase as any).rpc('deny_join_request', {
      _request_id: req.id,
      _note: reviewNotes[req.id] || null,
    });
    if (error) toast.error(error.message);
    else { toast.success('Request denied'); await load(); }
    setActingId(null);
  };

  const requestInfo = async (req: Request) => {
    const note = (reviewNotes[req.id] || '').trim();
    if (!note) {
      toast.error('Add a note explaining what info you need');
      return;
    }
    setActingId(req.id);
    const { error } = await (supabase as any).rpc('admin_set_request_needs_info', {
      _request_id: req.id,
      _admin_note: note,
    });
    if (error) toast.error(error.message);
    else { toast.success('User notified — waiting on their reply'); await load(); }
    setActingId(null);
  };

  const pending = requests.filter((r) => r.status === 'pending' || r.status === 'needs_info');
  const reviewed = requests.filter((r) => !['pending', 'needs_info'].includes(r.status));

  return (
    <div className="min-h-screen bg-background px-4 py-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mx-auto"
      >
        <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 btn-press">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))',
              border: '1px solid hsl(var(--gold) / 0.3)',
            }}
          >
            <Shield className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(var(--gold))' }}>
              Admin
            </p>
            <h1 className="text-lg font-extrabold leading-tight">Membership Requests</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="loading-spinner-ring" /></div>
        ) : (
          <>
            {/* Pending requests */}
            <section className="mb-6">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 mb-2 px-1">
                Pending {pending.length > 0 && <span className="ml-1 text-gold">({pending.length})</span>}
              </h2>
              {pending.length === 0 ? (
                <div className="glass-card p-5 text-center">
                  <p className="text-sm text-muted-foreground">No one waiting to join right now.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((req) => (
                    <div key={req.id} className="glass-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {(req.profile?.display_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-bold truncate">{req.profile?.display_name ?? 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">wants to join</p>
                          </div>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0"
                          style={{
                            background: req.status === 'needs_info' ? 'hsl(var(--gold) / 0.16)' : 'hsl(var(--muted) / 0.4)',
                            color: req.status === 'needs_info' ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))',
                          }}
                        >
                          {req.status === 'needs_info' ? 'Awaiting reply' : 'Pending'}
                        </span>
                      </div>
                      {req.user_note && (
                        <div className="text-sm leading-relaxed bg-primary/5 border border-primary/15 rounded-lg p-3 break-words">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-primary mb-1">Their note</p>
                          {req.user_note}
                        </div>
                      )}
                      <Textarea
                        placeholder="Note to requester (used by Deny and Ask for info)"
                        value={reviewNotes[req.id] ?? ''}
                        onChange={(e) => setReviewNotes((s) => ({ ...s, [req.id]: e.target.value }))}
                        rows={2}
                        className="form-input resize-none text-sm"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant="outline"
                          className="btn-press"
                          onClick={() => requestInfo(req)}
                          disabled={actingId === req.id}
                          title="Ask the user for more info"
                        >
                          <MessageCircle className="w-4 h-4 mr-1.5" /> Info
                        </Button>
                        <Button
                          variant="outline"
                          className="btn-press"
                          onClick={() => reject(req)}
                          disabled={actingId === req.id}
                        >
                          <X className="w-4 h-4 mr-1.5" /> Deny
                        </Button>
                        <Button
                          className="btn-press"
                          onClick={() => approve(req)}
                          disabled={actingId === req.id}
                        >
                          <Check className="w-4 h-4 mr-1.5" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Reviewed history */}
            {reviewed.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 mb-2 px-1">
                  Recent decisions
                </h2>
                <div className="space-y-2">
                  {reviewed.slice(0, 12).map((req) => (
                    <div key={req.id} className="glass-card p-3 flex items-center gap-3 opacity-80">
                      <UserPlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{req.profile?.display_name ?? 'Unknown'}</p>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                        style={{
                          background: req.status === 'approved' ? 'hsl(var(--primary) / 0.14)' : 'hsl(var(--destructive) / 0.14)',
                          color: req.status === 'approved' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
                        }}
                      >
                        {req.status === 'approved' ? 'approved' : req.status === 'rejected' ? 'denied' : req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
