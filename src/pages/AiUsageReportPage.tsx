import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, BarChart3, Zap, AlertTriangle, RefreshCw, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types mirroring the ai_usage_summary() RPC payload ──
interface FunctionRow { function_name: string; calls: number; total_tokens: number; failures: number }
interface ModelRow { model: string; calls: number; total_tokens: number }
interface DailyRow { day: string; calls: number; total_tokens: number }
interface Summary {
  since: string;
  scope: 'global' | 'club';
  totals: { calls: number; total_tokens: number; prompt_tokens: number; completion_tokens: number; failures: number };
  by_function: FunctionRow[];
  by_model: ModelRow[];
  daily: DailyRow[];
  error?: string;
}

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

// Relative cost tier per model, so the report explains WHY tokens cost what
// they do (a "pro" call is ~20-30x the price of "flash-lite").
function modelTier(model: string): { label: string; cls: string } {
  if (model.includes('pro')) return { label: 'Premium', cls: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
  if (model.includes('flash-lite')) return { label: 'Economy', cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  if (model.includes('flash')) return { label: 'Standard', cls: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
  return { label: 'Other', cls: 'text-muted-foreground bg-muted/40 border-border' };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export default function AiUsageReportPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: rpcErr } = await (supabase as any).rpc('ai_usage_summary', { _days: days });
      if (rpcErr) throw rpcErr;
      if (res?.error) throw new Error(res.error);
      setData(res as Summary);
    } catch (e: any) {
      setError(e?.message || 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const totals = data?.totals;
  const maxDaily = Math.max(1, ...(data?.daily || []).map(d => d.total_tokens));
  const maxFn = Math.max(1, ...(data?.by_function || []).map(f => f.total_tokens));

  return (
    <div className="min-h-screen px-4 pt-4 pb-24 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Link to="/club/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 btn-press">
          <ArrowLeft className="w-4 h-4" /> Club Settings
        </Link>

        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-black tracking-tight">AI Usage</h1>
              <p className="text-xs text-muted-foreground">
                {data?.scope === 'global' ? 'All clubs' : 'Your club'} · last {days} days
              </p>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-muted/60 btn-press" aria-label="Refresh">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Range selector */}
        <div className="flex gap-1.5 mb-4">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors btn-press',
                days === r.days ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="glass-card p-5 text-center space-y-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={load} className="text-sm font-bold text-primary hover:underline">Retry</button>
          </div>
        )}

        {loading && !data && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => <div key={i} className="glass-card h-24 animate-pulse" />)}
          </div>
        )}

        {data && !error && (
          <div className="space-y-4">
            {/* Totals */}
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Calls</p>
                <p className="text-2xl font-black tabular-nums">{fmt(totals?.calls || 0)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tokens</p>
                <p className="text-2xl font-black tabular-nums">{fmt(totals?.total_tokens || 0)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Failures</p>
                <p className={cn('text-2xl font-black tabular-nums', (totals?.failures || 0) > 0 && 'text-rose-500')}>{fmt(totals?.failures || 0)}</p>
              </div>
            </div>

            {(totals?.calls || 0) === 0 && (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                No AI calls recorded in this window yet. New usage will appear here as it happens.
              </div>
            )}

            {/* By function */}
            {(data.by_function?.length || 0) > 0 && (
              <section className="glass-card p-5 space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> By feature
                </h2>
                <div className="space-y-2.5">
                  {data.by_function.map(f => (
                    <div key={f.function_name}>
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold truncate">{f.function_name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                          {fmt(f.calls)} calls · {fmt(f.total_tokens)} tok
                          {f.failures > 0 && <span className="text-rose-500"> · {f.failures} failed</span>}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (f.total_tokens / maxFn) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* By model */}
            {(data.by_model?.length || 0) > 0 && (
              <section className="glass-card p-5 space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 flex items-center gap-1.5">
                  <Cpu className="w-3 h-3" /> By model
                </h2>
                <div className="space-y-2">
                  {data.by_model.map(m => {
                    const tier = modelTier(m.model);
                    return (
                      <div key={m.model} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0', tier.cls)}>{tier.label}</span>
                          <span className="text-sm font-medium truncate">{m.model.replace('google/', '')}</span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                          {fmt(m.calls)} calls · {fmt(m.total_tokens)} tok
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Daily trend */}
            {(data.daily?.length || 0) > 0 && (
              <section className="glass-card p-5 space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Daily tokens</h2>
                <div className="flex items-end gap-1 h-28">
                  {data.daily.map(d => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end group relative" title={`${d.day}: ${d.total_tokens} tokens, ${d.calls} calls`}>
                      <div
                        className="w-full rounded-t bg-primary/70 group-hover:bg-primary transition-colors"
                        style={{ height: `${Math.max(2, (d.total_tokens / maxDaily) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{data.daily[0]?.day.slice(5)}</span>
                  <span>{data.daily[data.daily.length - 1]?.day.slice(5)}</span>
                </div>
              </section>
            )}

            <p className="text-[11px] text-muted-foreground/70 leading-relaxed px-1">
              Counts every call your app makes to the Lovable AI gateway. Premium (pro) calls cost
              far more per token than economy calls — watch the "By model" split. This is app-side
              usage; your Lovable billing dashboard remains the source of truth for credit balance.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
