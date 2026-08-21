import { Link } from 'react-router-dom';
import { Sparkles, BarChart3, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useClubAI } from '@/hooks/useClubAI';

/**
 * Club Settings panel: the AI master switch + a link into the usage report.
 * Turning AI off makes every AI-backed feature (draft spell-check, ratings,
 * suggestions, enrichment, narrative AI) stop spending Lovable AI credits —
 * enforced server-side by the `ai_gate()` RPC, so it's a true kill switch.
 */
export function ClubAISettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const { aiEnabled, loading, saving, setAiEnabled } = useClubAI();

  if (!isAdmin) return null;

  const onToggle = async (next: boolean) => {
    try {
      await setAiEnabled(next);
      toast.success(next ? 'AI features enabled' : 'AI features turned off');
    } catch {
      toast.error('Could not update AI setting');
    }
  };

  return (
    <section className="glass-card p-5 mb-4 space-y-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" /> AI Features
      </h2>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">AI-powered features</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick spell-check, draft ratings, suggestions, item enrichment and narrative AI.
            Turning this off stops all AI credit usage for your club.
          </p>
        </div>
        <Switch
          checked={aiEnabled}
          disabled={loading || saving}
          onCheckedChange={onToggle}
          aria-label="Toggle AI features"
        />
      </div>

      <Link
        to="/club/ai-usage"
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors btn-press"
      >
        <BarChart3 className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm font-medium flex-1">View AI usage report</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </section>
  );
}
