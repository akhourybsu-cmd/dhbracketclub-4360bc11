import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { nukeAndReload, subscribeProbeState, fetchRemoteBuildId, type ProbeState } from '@/lib/forceUpdate';
import { toast } from 'sonner';
import { Bell, RefreshCw, Loader2, Activity } from 'lucide-react';

function formatRelative(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function outcomeColor(o: ProbeState['lastOutcome'] | undefined): string {
  switch (o) {
    case 'ok': return 'hsl(var(--primary))';
    case 'mismatch': return 'hsl(var(--gold))';
    case 'network-failed':
    case 'invalid-json': return 'hsl(var(--destructive))';
    default: return 'hsl(var(--muted-foreground))';
  }
}

export default function AdminDiagnosticsPage() {
  const { user } = useAuth();
  const { isSubscribed, subscribe } = usePushNotifications();
  const { play } = useSoundEffect();
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probe, setProbe] = useState<ProbeState | null>(null);
  const [checking, setChecking] = useState(false);
  const [activity, setActivity] = useState<Array<{ type: string; count: number }>>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

  useEffect(() => subscribeProbeState(setProbe), []);

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    (supabase as any)
      .from('notification_sent_log')
      .select('type')
      .gte('sent_at', since)
      .then(({ data }: { data: any[] | null }) => {
        const counts = new Map<string, number>();
        for (const r of data || []) counts.set(r.type, (counts.get(r.type) || 0) + 1);
        setActivity([...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));
        setActivityLoading(false);
      });
  }, []);

  const handleForceRefresh = async () => {
    setRefreshing(true);
    play('tap');
    toast.loading('Clearing cache and reloading…');
    await nukeAndReload();
  };

  const handleTestPush = async () => {
    if (!user) return;
    setTesting(true);
    try {
      if (!isSubscribed) {
        const ok = await subscribe();
        if (!ok) {
          toast.error('Allow notification permissions first');
          setTesting(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { test: true, user_id: user.id },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success('Test notification sent!');
        play('success');
      } else {
        toast.error(data?.error || 'No test notification was delivered.');
        play('error');
      }
    } catch (err) {
      console.error('Test push error:', err);
      toast.error('Failed to send test notification');
      play('error');
    }
    setTesting(false);
  };

  const handleCheck = async () => {
    setChecking(true);
    await fetchRemoteBuildId();
    setChecking(false);
  };

  const localShort = String(buildId).slice(0, 12);
  const remoteShort = probe?.lastRemoteBuildId ? String(probe.lastRemoteBuildId).slice(0, 12) : '—';
  const isStale = probe?.lastOutcome === 'mismatch';

  return (
    <AdminLayout title="Diagnostics" subtitle="Force the app to refresh, send a test notification, and inspect the build/service-worker probe.">
      <div className="space-y-3">
        <button
          onClick={handleForceRefresh}
          disabled={refreshing}
          className="w-full glass-card p-4 flex items-center gap-3 btn-press text-left disabled:opacity-60"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(var(--primary) / 0.14)', border: '1px solid hsl(var(--primary) / 0.22)' }}
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <RefreshCw className="w-4 h-4 text-primary" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-tight">Force Refresh App</p>
            <p className="text-[11px] text-muted-foreground/80">Clear cache &amp; pull latest build</p>
          </div>
        </button>

        <button
          onClick={handleTestPush}
          disabled={testing}
          className="w-full glass-card p-4 flex items-center gap-3 btn-press text-left disabled:opacity-60"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(var(--warning) / 0.14)', border: '1px solid hsl(var(--warning) / 0.22)' }}
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin text-warning" /> : <Bell className="w-4 h-4 text-warning" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-tight">Send Test Notification</p>
            <p className="text-[11px] text-muted-foreground/80">Verify push delivery to this device</p>
          </div>
        </button>
      </div>

      <div
        className="mt-4 glass-card p-4 space-y-2"
        style={{ borderColor: isStale ? 'hsl(var(--gold) / 0.4)' : undefined }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
            Update Diagnostics
          </p>
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="text-[10px] font-semibold px-2 py-1 rounded-md disabled:opacity-50 btn-press"
            style={{
              color: 'hsl(var(--primary))',
              background: 'hsl(var(--primary) / 0.1)',
              border: '1px solid hsl(var(--primary) / 0.3)',
            }}
          >
            {checking ? 'Checking…' : 'Check now'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono">
          <span className="text-muted-foreground/70">local build</span>
          <span className="text-right truncate">{localShort}</span>

          <span className="text-muted-foreground/70">remote build</span>
          <span className="text-right truncate" style={{ color: isStale ? 'hsl(var(--gold))' : undefined }}>
            {remoteShort}
          </span>

          <span className="text-muted-foreground/70">last probe</span>
          <span className="text-right" style={{ color: outcomeColor(probe?.lastOutcome) }}>
            {probe?.lastOutcome ?? 'never'} · {formatRelative(probe?.lastAttemptAt ?? null)}
          </span>

          <span className="text-muted-foreground/70">last success</span>
          <span className="text-right">{formatRelative(probe?.lastSuccessAt ?? null)}</span>

          <span className="text-muted-foreground/70">probes ok / fail</span>
          <span className="text-right">{probe?.successes ?? 0} / {probe?.failures ?? 0}</span>
        </div>
      </div>

      <div className="mt-3 px-1 flex items-center justify-between text-[9px] font-mono text-muted-foreground/60">
        <span>build {localShort}</span>
        <span className="truncate max-w-[160px]">uid {user?.id.slice(0, 8)}…</span>
      </div>
    </AdminLayout>
  );
}
