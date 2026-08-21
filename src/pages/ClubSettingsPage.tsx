import { useEffect, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Building2, ArrowLeft, Copy, Plus, Users, Crown, KeyRound, Eye, EyeOff, RefreshCw, Package, ChevronRight, Sparkles } from 'lucide-react';
import { CelebrationSettingsPanel } from '@/components/celebrations/CelebrationSettingsPanel';
import { MessageReportsPanel } from '@/components/chat/MessageReportsPanel';
import { NarrativeApprovalsPanel } from '@/components/narrative/NarrativeApprovalsPanel';
import { ClubAISettingsPanel } from '@/components/clubAI/ClubAISettingsPanel';

type InviteCode = {
  id: string;
  code: string;
  is_active: boolean;
  used_at: string | null;
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { display_name: string; avatar_url: string | null };
};

const PRESET_ACCENTS: { label: string; color: string }[] = [
  { label: 'Emerald', color: '152 72% 46%' },
  { label: 'Amber', color: '38 92% 50%' },
  { label: 'Sky', color: '199 89% 48%' },
  { label: 'Rose', color: '350 84% 60%' },
  { label: 'Violet', color: '262 83% 58%' },
  { label: 'Coral', color: '14 90% 60%' },
];

export default function ClubSettingsPage() {
  const { club, isClubAdmin, loading, refresh } = useClub();
  const { installedAssets } = useClubAssets();
  // ≤3 installed = only the auto-installed defaults (Chat, Feed, Events), so show the onboarding CTA
  const isNewClub = installedAssets.length <= 3;
  const [name, setName] = useState('');
  const [accent, setAccent] = useState('152 72% 46%');
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  const loadAll = useCallback(async () => {
    if (!club) return;
    const { data: m, error: mErr } = await (supabase as any)
      .from('club_members').select('id, user_id, role, joined_at').eq('club_id', club.id).order('joined_at', { ascending: true });
    if (mErr) console.warn('[ClubSettings] members load error', mErr);
    if (m && m.length) {
      const ids = (m as any[]).map((x) => x.user_id);
      const { data: profs } = await (supabase as any)
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setMembers((m as any[]).map((row) => ({ ...row, profile: byId.get(row.user_id) })) as Member[]);
    } else {
      setMembers([]);
    }
  }, [club]);

  useEffect(() => {
    if (club) {
      setName(club.name);
      setAccent(club.accent_color);
      void loadAll();
    }
  }, [club, loadAll]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="loading-spinner-ring" /></div>;
  if (!club || !isClubAdmin) return <Navigate to="/profile" replace />;

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('clubs')
      .update({ name: name.trim(), accent_color: accent })
      .eq('id', club.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Club updated');
    await refresh();
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto">
        <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 btn-press">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(${accent} / 0.22), hsl(${accent} / 0.04))`,
              border: `1px solid hsl(${accent} / 0.3)`,
            }}
          >
            <Building2 className="w-5 h-5" style={{ color: `hsl(${accent})` }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Club Admin</p>
            <h1 className="text-lg font-extrabold leading-tight">Manage {club.name}</h1>
          </div>
        </div>

        {/* Branding */}
        <section className="glass-card p-5 mb-4 space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Branding</h2>
          <div>
            <label className="form-label">Club Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} className="form-input" />
          </div>
          <div>
            <label className="form-label">Accent Color</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_ACCENTS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => setAccent(p.color)}
                  className="rounded-xl p-2.5 flex flex-col items-center gap-1.5 btn-press"
                  style={{
                    background: accent === p.color ? `hsl(${p.color} / 0.16)` : 'hsl(var(--muted) / 0.3)',
                    border: accent === p.color ? `2px solid hsl(${p.color})` : '2px solid transparent',
                  }}
                >
                  <span className="w-6 h-6 rounded-full" style={{ background: `hsl(${p.color})` }} />
                  <span className="text-[10px] font-semibold">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving} className="w-full h-11 font-bold rounded-xl btn-press">
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </section>

        {/* Membership — approval-based access to the single club */}
        <section className="glass-card p-5 mb-4 space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Membership
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This club is invite-only. New people create an account and request access — you approve
            each one in <Link to="/admin/clubs" className="text-primary font-semibold hover:underline">Membership Requests</Link>.
          </p>
        </section>

        {/* Asset Library — onboarding CTA for new clubs, compact summary for established ones */}
        {isNewClub ? (
          <section
            className="glass-card p-5 mb-4 relative overflow-hidden"
            style={{ borderColor: `hsl(${accent} / 0.35)`, boxShadow: `0 0 0 1px hsl(${accent} / 0.12), 0 4px 24px hsl(${accent} / 0.08)` }}
          >
            {/* Background glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 90% 20%, hsl(${accent} / 0.08), transparent 65%)` }}
            />
            <div className="relative">
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `hsl(${accent} / 0.14)`, border: `1px solid hsl(${accent} / 0.25)` }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: `hsl(${accent})` }} />
                </div>
                <div>
                  <h2 className="font-extrabold text-[14px] tracking-tight leading-tight">Add features to your club</h2>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-relaxed">
                    Your club has Home, Chat, Feed, and Events. Browse the Asset Library to add games, polls, rankings, and more.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {['Draft Arena', 'Rune Delve', 'Nexus Defense', 'Brackets', 'Polls', 'Rankings', '+9 more'].map(label => (
                  <span
                    key={label}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: `hsl(${accent} / 0.1)`, color: `hsl(${accent} / 0.9)`, border: `1px solid hsl(${accent} / 0.2)` }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <Link
                to="/club/assets"
                className="flex items-center justify-center gap-2 w-full h-10 rounded-xl font-extrabold text-[13px] transition-all active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.8))`,
                  color: 'hsl(220 60% 4%)',
                  boxShadow: `0 4px 16px hsl(${accent} / 0.3)`,
                }}
              >
                <Package className="w-4 h-4" /> Browse Asset Library
              </Link>
            </div>
          </section>
        ) : (
          <section className="glass-card p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 flex items-center gap-1.5">
                  <Package className="w-3 h-3" /> Asset Library
                </h2>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {installedAssets.length} feature{installedAssets.length !== 1 ? 's' : ''} installed
                </p>
              </div>
              <Link
                to="/club/assets"
                className="flex items-center gap-1 text-[11px] font-bold text-primary btn-press"
              >
                Manage <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        )}

        {/* Plugin: Celebrations — only renders when birthdays-milestones is installed */}
        <div className="mb-4">
          <CelebrationSettingsPanel
            installed={installedAssets.some(ia => ia.asset.slug === 'birthdays-milestones' && ia.enabled)}
            isAdmin={isClubAdmin}
          />
        </div>

        {/* Plugin: Message Reports — admin moderation queue, gated on chat installed */}
        <div className="mb-4">
          <MessageReportsPanel
            installed={installedAssets.some(ia => ia.asset.slug === 'chat' && ia.enabled)}
            isAdmin={isClubAdmin}
          />
        </div>

        {/* Plugin: Narrative RPG — campaign approval queue, gated on narrative-rpg installed */}
        <div className="mb-4">
          <NarrativeApprovalsPanel
            installed={installedAssets.some(ia => ia.asset.slug === 'narrative-rpg' && ia.enabled)}
            isAdmin={isClubAdmin}
          />
        </div>

        {/* AI features master switch + usage report */}
        <ClubAISettingsPanel isAdmin={isClubAdmin} />

        {/* Members */}
        <section className="glass-card p-5 space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Members ({members.length})
          </h2>
          <div className="space-y-1.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-1.5">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {m.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{m.profile?.display_name ?? 'Unknown'}</p>
                </div>
                {m.role === 'admin' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gold">
                    <Crown className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </motion.div>
    </div>
  );
}
