import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminStatTile, AdminSectionCard } from '@/components/admin/AdminPrimitives';
import {
  Users, Activity, Trophy, Megaphone, Flag, ScrollText, Wrench, Sparkles, BarChart3, Package, UserPlus,
} from 'lucide-react';

type Stats = {
  members: number | null;
  users: number | null;
  drafts: number | null;
  recentActivity: number | null;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ members: null, users: null, drafts: null, recentActivity: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [members, users, drafts, activity] = await Promise.all([
        (supabase as any).from('club_members').select('id', { count: 'exact', head: true }),
        (supabase as any).from('profiles').select('id', { count: 'exact', head: true }),
        (supabase as any).from('drafts').select('id', { count: 'exact', head: true }),
        (supabase as any).from('activity_feed').select('id', { count: 'exact', head: true }).gte('created_at', since),
      ]);
      if (cancelled) return;
      setStats({
        members: members.count ?? 0,
        users: users.count ?? 0,
        drafts: drafts.count ?? 0,
        recentActivity: activity.count ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminLayout
      title="Admin"
      subtitle="Manage members, competitions, and app-wide settings for the club."
    >
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <AdminStatTile icon={Users} label="Members" value={stats.members ?? '—'} color="gold" loading={stats.members === null} />
        <AdminStatTile icon={Users} label="Users" value={stats.users ?? '—'} color="primary" loading={stats.users === null} />
        <AdminStatTile icon={Trophy} label="Drafts" value={stats.drafts ?? '—'} color="accent" loading={stats.drafts === null} />
        <AdminStatTile icon={Activity} label="Activity (7d)" value={stats.recentActivity ?? '—'} color="warning" loading={stats.recentActivity === null} />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
        Management
      </p>
      <div className="space-y-2 mb-5">
        <AdminSectionCard to="/admin/clubs" icon={UserPlus} label="Membership Requests" description="Approve people who want to join the club" color="gold" />
        <AdminSectionCard to="/admin/users" icon={Users} label="Users" description="Search profiles, memberships, roles" color="primary" />
        <AdminSectionCard to="/admin/competitions" icon={Trophy} label="Competitions" description="Drafts, Pick'em, Nexus, Rune Delve admin" color="accent" />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
        Platform
      </p>
      <div className="space-y-2 mb-5">
        <AdminSectionCard to="/admin/assets" icon={Package} label="Asset Catalog" description="Manage features available to the club" color="primary" />
        <AdminSectionCard to="/admin/announcements" icon={Megaphone} label="Announcements" description="Push platform-wide messages" color="warning" badge="Soon" />
        <AdminSectionCard to="/admin/feature-flags" icon={Flag} label="Feature Flags" description="Toggle modules and beta tools" color="primary" badge="Soon" />
        <AdminSectionCard to="/admin/notes" icon={Sparkles} label="Polish Notes" description="UI / mobile refinement checklist" color="accent" badge="Soon" />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
        Operations
      </p>
      <div className="space-y-2">
        <AdminSectionCard to="/admin/audit" icon={ScrollText} label="Audit Log" description="Recent platform-wide activity" color="gold" />
        <AdminSectionCard to="/admin/diagnostics" icon={Wrench} label="Diagnostics" description="Force refresh, push test, build info" color="primary" />
        <AdminSectionCard to="/nexus/balance" icon={BarChart3} label="Nexus Balance" description="Mission, tower & ability telemetry" color="accent" />
      </div>
    </AdminLayout>
  );
}
