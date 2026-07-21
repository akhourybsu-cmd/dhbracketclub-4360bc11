// READSHIFT — commissioner (host/admin) controls for an in-flight game.
// Every action delegates to the server-authoritative readshift-advance edge
// function, which re-checks permissions and legality. These buttons only
// surface the actions that are valid for the current phase.
import { useState } from 'react';
import { Pause, Play, FastForward, Clock, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as api from '@/lib/readshift/api';
import type { RsGame } from '@/lib/readshift/dbTypes';

export function CommissionerControls({ game, onChanged }: { game: RsGame; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const isPaused = game.phase === 'paused';
  const isActive = ['shift', 'read', 'reveal'].includes(game.phase);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    try { await fn(); toast.success(okMsg); onChanged(); }
    catch (e: any) { toast.error(e?.message || 'Something went wrong'); }
    finally { setBusy(null); }
  };

  const Btn = ({ id, icon: Icon, label, onClick, danger }: {
    id: string; icon: typeof Pause; label: string; onClick: () => void; danger?: boolean;
  }) => (
    <button onClick={onClick} disabled={busy !== null}
      className={cn('flex-1 min-w-[calc(50%-0.25rem)] h-10 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors btn-press disabled:opacity-50',
        danger ? 'bg-destructive/10 text-destructive hover:bg-destructive/15' : 'bg-muted/50 hover:bg-muted')}>
      {busy === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/60">Commissioner</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {isActive && (
          <Btn id="force" icon={FastForward} label="Advance now"
            onClick={() => run('force', () => api.triggerPhase(game.id, 'force'), 'Advanced')} />
        )}
        {isActive && (
          <Btn id="extend" icon={Clock} label="Extend +12h"
            onClick={() => run('extend', () => api.extendPhase(game.id, 12), 'Extended by 12h')} />
        )}
        {isActive && (
          <Btn id="pause" icon={Pause} label="Pause"
            onClick={() => run('pause', () => api.triggerPhase(game.id, 'pause'), 'Paused')} />
        )}
        {isPaused && (
          <Btn id="resume" icon={Play} label="Resume"
            onClick={() => run('resume', () => api.triggerPhase(game.id, 'resume'), 'Resumed')} />
        )}
        {confirmCancel ? (
          <>
            <Btn id="cancel" icon={XCircle} label="Confirm cancel" danger
              onClick={() => run('cancel', () => api.triggerPhase(game.id, 'cancel'), 'Game cancelled')} />
            <button onClick={() => setConfirmCancel(false)} disabled={busy !== null}
              className="flex-1 min-w-[calc(50%-0.25rem)] h-10 rounded-lg text-[12px] font-bold bg-muted/50 hover:bg-muted transition-colors btn-press">
              Keep playing
            </button>
          </>
        ) : (
          <Btn id="cancel-init" icon={XCircle} label="Cancel game" danger onClick={() => setConfirmCancel(true)} />
        )}
      </div>
    </div>
  );
}
