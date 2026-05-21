// DH Club — Narrative RPG · Member management (invite / role / remove)
//
// GM or club-admin opens this from the campaign detail page. They can:
//   • Search club members by display_name + add them to the campaign
//     as Player or Spectator.
//   • Change an existing member's role.
//   • Remove a member entirely.
//
// Guards:
//   • Cannot demote / remove the only Game Master (the campaign always
//     needs at least one GM). The check runs client-side here AND is
//     enforced by RLS at the DB layer for defense-in-depth.
//   • Spectators cannot be promoted to GM directly — to make someone
//     the GM you must remove the existing GM (a separate flow).

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, UserPlus, Search, Loader2, UserMinus, Crown, Eye, User, Archive, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';
import { useNarrativeCampaigns } from '@/hooks/useNarrativeCampaigns';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import type { Campaign, CampaignMember, MemberRole } from '@/lib/narrative/types';

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  members: CampaignMember[];
  /** Called after any mutation so the parent can refresh. */
  onChanged?: () => void;
}

interface ClubMemberLite {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

const ROLE_LABEL: Record<MemberRole, string> = {
  game_master: 'Game Master',
  player: 'Player',
  spectator: 'Spectator',
};

export function MemberManagementSheet({ open, onClose, campaign, members, onChanged }: Props) {
  const { club, isClubAdmin } = useClub();
  const navigate = useNavigate();
  const { archiveCampaign, deleteCampaign } = useNarrativeCampaigns();
  const [search, setSearch] = useState('');
  const [clubMembers, setClubMembers] = useState<ClubMemberLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  // Danger-zone state. `dangerStep` controls which destructive action is
  // expanded inline (avoids a separate alert dialog). 'delete' requires
  // the user to type the campaign title to confirm.
  const [dangerStep, setDangerStep] = useState<'idle' | 'archive' | 'delete'>('idle');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);

  useEffect(() => {
    if (!open || !club?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Two-step fetch: don't rely on the PostgREST nested-select
      // `profiles:user_id(...)` pattern, which silently errored
      // ("Failed to load club members") whenever the
      // club_members.user_id → profiles.id FK wasn't configured at
      // the DB level. This path works regardless and surfaces real
      // errors clearly.
      const { data: memberRows, error: memberErr } = await (supabase as any)
        .from('club_members')
        .select('user_id')
        .eq('club_id', club.id);
      if (cancelled) return;
      if (memberErr) {
        toast.error(`Couldn't load club members: ${memberErr.message}`);
        setClubMembers([]);
        setLoading(false);
        return;
      }
      const userIds = [...new Set((memberRows ?? []).map((r: any) => r.user_id).filter(Boolean))];
      if (userIds.length === 0) {
        setClubMembers([]);
        setLoading(false);
        return;
      }
      const { data: profileRows, error: profileErr } = await (supabase as any)
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      if (cancelled) return;
      if (profileErr) {
        // Profiles fetch is best-effort — even if it fails, we can still
        // surface user_ids with "Unknown member" labels so the invite
        // flow remains usable.
        console.warn('[MemberManagementSheet] profiles fetch failed:', profileErr);
      }
      const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      (profileRows ?? []).forEach((p: any) => {
        profileMap.set(p.id, { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null });
      });
      const rows: ClubMemberLite[] = (userIds as string[]).map(uid => ({
        user_id: uid,
        display_name: profileMap.get(uid)?.display_name ?? null,
        avatar_url: profileMap.get(uid)?.avatar_url ?? null,
      }));
      setClubMembers(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, club?.id]);

  /** Members currently in the campaign by user id. */
  const membersById = useMemo(() => {
    const m = new Map<string, CampaignMember>();
    for (const x of members) m.set(x.user_id, x);
    return m;
  }, [members]);

  /** Club members NOT already in the campaign — candidates to invite. */
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubMembers
      .filter(cm => !membersById.has(cm.user_id) || membersById.get(cm.user_id)?.status === 'removed')
      .filter(cm => q.length === 0 || (cm.display_name ?? '').toLowerCase().includes(q));
  }, [clubMembers, membersById, search]);

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingInvites = members.filter(m => m.status === 'invited');
  const gmCount = activeMembers.filter(m => m.role === 'game_master').length;

  const invite = async (userId: string, role: MemberRole) => {
    setBusyUserId(userId);
    const existing = membersById.get(userId);
    // New flow (Phase 3): invited members get status='invited' and must
    // accept before they show up in the active roster. The campaign
    // detail page renders an Accept/Decline banner when the viewer is
    // invited. Re-inviting a previously-removed member still goes
    // through the same RSVP step so they don't just snap back to active.
    const { error } = existing
      ? await (supabase as any).from('narrative_campaign_members')
          .update({ role, status: 'invited' })
          .eq('id', existing.id)
      : await (supabase as any).from('narrative_campaign_members').insert({
          campaign_id: campaign.id,
          user_id: userId,
          role,
          status: 'invited',
        });
    setBusyUserId(null);
    if (error) { toast.error(`Couldn't invite member: ${error.message}`); return; }
    toast.success(`Invite sent — ${ROLE_LABEL[role]}.`);
    onChanged?.();
  };

  const changeRole = async (mem: CampaignMember, role: MemberRole) => {
    // Refuse to demote the only GM.
    if (mem.role === 'game_master' && role !== 'game_master' && gmCount <= 1) {
      toast.error('Promote another Game Master before changing this role.');
      return;
    }
    setBusyUserId(mem.user_id);
    const { error } = await (supabase as any).from('narrative_campaign_members')
      .update({ role })
      .eq('id', mem.id);
    setBusyUserId(null);
    if (error) { toast.error(`Couldn't change role: ${error.message}`); return; }
    toast.success(`Role changed to ${ROLE_LABEL[role]}.`);
    onChanged?.();
  };

  const remove = async (mem: CampaignMember) => {
    if (mem.role === 'game_master' && gmCount <= 1) {
      toast.error('Promote another Game Master before removing the current one.');
      return;
    }
    setBusyUserId(mem.user_id);
    const { error } = await (supabase as any).from('narrative_campaign_members')
      .update({ status: 'removed' })
      .eq('id', mem.id);
    setBusyUserId(null);
    if (error) { toast.error(`Couldn't remove: ${error.message}`); return; }
    toast.success('Removed from campaign.');
    onChanged?.();
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
            <UserPlus className="w-4 h-4 text-primary" />
            <h2 className="text-[14px] font-extrabold tracking-tight">Manage members</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Current members */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
              Current members ({activeMembers.length})
            </p>
            <div className="space-y-1.5">
              {activeMembers.map(mem => {
                const profile = clubMembers.find(cm => cm.user_id === mem.user_id);
                const name = profile?.display_name ?? 'Unknown member';
                const isBusy = busyUserId === mem.user_id;
                const RoleIcon = mem.role === 'game_master' ? Crown : mem.role === 'spectator' ? Eye : User;
                return (
                  <div key={mem.id} className="rounded-xl bg-muted/25 border border-border/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-extrabold truncate">{name}</p>
                        <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground/70 inline-flex items-center gap-1">
                          <RoleIcon className="w-2.5 h-2.5" /> {ROLE_LABEL[mem.role]}
                        </p>
                      </div>
                      {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/70 flex-shrink-0" />}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {mem.role !== 'game_master' && (
                        <button
                          type="button"
                          onClick={() => changeRole(mem, 'game_master')}
                          disabled={isBusy}
                          className="flex-1 h-8 rounded-md text-[10px] font-extrabold bg-muted/40 border border-border/40 active:scale-95 disabled:opacity-50"
                        >
                          Make GM
                        </button>
                      )}
                      {mem.role !== 'player' && (
                        <button
                          type="button"
                          onClick={() => changeRole(mem, 'player')}
                          disabled={isBusy}
                          className="flex-1 h-8 rounded-md text-[10px] font-extrabold bg-muted/40 border border-border/40 active:scale-95 disabled:opacity-50"
                        >
                          Player
                        </button>
                      )}
                      {mem.role !== 'spectator' && (
                        <button
                          type="button"
                          onClick={() => changeRole(mem, 'spectator')}
                          disabled={isBusy}
                          className="flex-1 h-8 rounded-md text-[10px] font-extrabold bg-muted/40 border border-border/40 active:scale-95 disabled:opacity-50"
                        >
                          Spectator
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(mem)}
                        disabled={isBusy}
                        aria-label="Remove member"
                        className="w-8 h-8 rounded-md text-destructive bg-destructive/12 border border-destructive/30 active:scale-95 disabled:opacity-50 flex items-center justify-center"
                      >
                        <UserMinus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {activeMembers.length === 0 && (
                <p className="text-[11.5px] text-muted-foreground/70 text-center py-3">No active members.</p>
              )}
            </div>
          </section>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <section>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-warning mb-2">
                Pending invites ({pendingInvites.length})
              </p>
              <div className="space-y-1.5">
                {pendingInvites.map(mem => {
                  const profile = clubMembers.find(cm => cm.user_id === mem.user_id);
                  const name = profile?.display_name ?? 'Unknown member';
                  return (
                    <div key={mem.id} className="rounded-xl bg-warning/5 border border-warning/30 p-2.5 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-extrabold truncate">{name}</p>
                        <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          Invited as {ROLE_LABEL[mem.role]} — waiting for response
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(mem)}
                        aria-label="Cancel invite"
                        className="w-7 h-7 rounded-md text-muted-foreground/60 active:scale-90 flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Invite */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Invite from club</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/55 pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search club members…"
                className="h-10 pl-8 text-[13px]"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/70" />
              </div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {candidates.length === 0 && (
                  <p className="text-[11.5px] text-muted-foreground/70 text-center py-3">
                    {search.trim() ? 'No matches.' : 'Everyone in the club is already in this campaign.'}
                  </p>
                )}
                {candidates.slice(0, 30).map(cm => {
                  const isBusy = busyUserId === cm.user_id;
                  const wasRemoved = membersById.get(cm.user_id)?.status === 'removed';
                  return (
                    <div key={cm.user_id} className="rounded-xl bg-card border border-border/40 p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                          {(cm.display_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-extrabold truncate">{cm.display_name ?? 'Unknown'}</p>
                          {wasRemoved && <StatusPill variant="warning" size="xs">Previously removed</StatusPill>}
                        </div>
                        {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/70" />}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => invite(cm.user_id, 'player')}
                          disabled={isBusy}
                          className="flex-1 h-8 rounded-md text-[10.5px] font-extrabold inline-flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                          style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.35)' }}
                        >
                          <UserPlus className="w-3 h-3" /> Player
                        </button>
                        <button
                          type="button"
                          onClick={() => invite(cm.user_id, 'spectator')}
                          disabled={isBusy || !campaign.spectators_allowed}
                          className="flex-1 h-8 rounded-md text-[10.5px] font-extrabold bg-muted/40 border border-border/40 active:scale-95 disabled:opacity-50"
                        >
                          Spectator
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!campaign.spectators_allowed && (
              <p className="text-[10px] text-muted-foreground/60 mt-2">Spectators disabled for this campaign — toggle in campaign settings to enable.</p>
            )}
          </section>

          {/* Danger zone — Archive (any GM) + Delete (club admin only).
              Archive flips status to 'archived' so the campaign drops
              out of active lists but data is preserved. Delete is hard
              + cascades through every child row (members, characters,
              messages, scenes, NPCs, clues, items, factions, clocks,
              memory, summaries, rolls, AI suggestions, GM notes,
              approval events). */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive/80" />
              <h3 className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-destructive/80">
                Danger zone
              </h3>
            </div>

            {/* Archive */}
            {dangerStep !== 'archive' ? (
              <button
                type="button"
                onClick={() => { setDangerStep('archive'); setDeleteConfirmText(''); }}
                disabled={dangerBusy || campaign.status === 'archived'}
                className="w-full h-10 rounded-xl text-[11.5px] font-bold inline-flex items-center justify-center gap-1.5 bg-muted/30 border border-warning/40 text-warning hover:bg-warning/10 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                {campaign.status === 'archived' ? 'Already archived' : 'Archive campaign'}
              </button>
            ) : (
              <div className="rounded-xl border border-warning/40 p-3 space-y-2" style={{ background: 'hsl(38 95% 50% / 0.06)' }}>
                <p className="text-[11.5px] leading-snug">
                  <span className="font-extrabold">Archive this campaign?</span> It will drop out of the active list. Data is preserved and a club admin can still delete it later.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDangerStep('idle')}
                    disabled={dangerBusy}
                    className="flex-1 h-9 rounded-lg text-[11px] font-bold bg-muted/40 border border-border/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={dangerBusy}
                    onClick={async () => {
                      setDangerBusy(true);
                      try {
                        const ok = await archiveCampaign(campaign.id);
                        if (!ok) { toast.error("Couldn't archive campaign."); return; }
                        toast.success('Campaign archived.');
                        onChanged?.();
                        setDangerStep('idle');
                        onClose();
                      } catch (e) {
                        toast.error(`Archive failed: ${(e as Error).message ?? 'unknown error'}`);
                      } finally {
                        setDangerBusy(false);
                      }
                    }}
                    className="flex-1 h-9 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    style={{ background: 'hsl(38 95% 50% / 0.2)', color: 'hsl(38 95% 50%)', border: '1px solid hsl(38 95% 50% / 0.5)' }}
                  >
                    {dangerBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                    Confirm archive
                  </button>
                </div>
              </div>
            )}

            {/* Delete — club admin only. Hard delete + cascade.
                Type-to-confirm prevents accidental destruction. */}
            {isClubAdmin && (dangerStep !== 'delete' ? (
              <button
                type="button"
                onClick={() => { setDangerStep('delete'); setDeleteConfirmText(''); }}
                disabled={dangerBusy}
                className="w-full h-10 rounded-xl text-[11.5px] font-bold inline-flex items-center justify-center gap-1.5 bg-destructive/8 border border-destructive/40 text-destructive hover:bg-destructive/15 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete campaign permanently
              </button>
            ) : (
              <div className="rounded-xl border border-destructive/50 p-3 space-y-2" style={{ background: 'hsl(var(--destructive) / 0.06)' }}>
                <p className="text-[11.5px] leading-snug">
                  <span className="font-extrabold text-destructive">This deletes everything</span> — characters, messages, dice rolls, NPCs, clues, factions, clocks, memory, summaries. <span className="font-extrabold">Cannot be undone.</span>
                </p>
                <p className="text-[10.5px] text-muted-foreground/85">
                  Type the campaign title to confirm:
                </p>
                <p className="text-[11px] font-extrabold text-foreground/90 break-words">{campaign.title}</p>
                <Input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Type exact title…"
                  className="h-9 text-[12px]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setDangerStep('idle'); setDeleteConfirmText(''); }}
                    disabled={dangerBusy}
                    className="flex-1 h-9 rounded-lg text-[11px] font-bold bg-muted/40 border border-border/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={dangerBusy || deleteConfirmText.trim() !== campaign.title.trim()}
                    onClick={async () => {
                      setDangerBusy(true);
                      try {
                        const ok = await deleteCampaign(campaign.id);
                        if (!ok) { toast.error("Couldn't delete campaign."); return; }
                        toast.success('Campaign deleted.');
                        // Navigate away — the campaign no longer exists.
                        // Realtime DELETE subscription on the list view
                        // catches the removal for other viewers.
                        navigate('/narrative');
                      } catch (e) {
                        toast.error(`Delete failed: ${(e as Error).message ?? 'unknown error'}`);
                      } finally {
                        setDangerBusy(false);
                      }
                    }}
                    className="flex-1 h-9 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-40"
                    style={{ background: 'hsl(var(--destructive) / 0.18)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.55)' }}
                  >
                    {dangerBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Delete permanently
                  </button>
                </div>
              </div>
            ))}
            {!isClubAdmin && (
              <p className="text-[10px] text-muted-foreground/60">
                Only club admins can permanently delete campaigns. Archive is reversible.
              </p>
            )}
          </section>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
