import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Settings, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';
import { useCountdown, formatCountdownShort } from '@/lib/workout/week';

/** Sticky in-game HUD for the FORGE shell — replaces the DH header while
 *  inside /workouts/*. Shows a live weekly countdown and (for admins) a
 *  shortcut to the commissioner tools. */
export function ForgeHUD() {
  const location = useLocation();
  const navigate = useNavigate();
  const { club, isClubAdmin } = useClub();
  const path = location.pathname;
  const isHub = path === '/workouts';
  const isAdmin = path.startsWith('/workouts/admin');

  const [endsAt, setEndsAt] = useState<string | null>(null);
  useEffect(() => {
    if (!club?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('workout_weeks').select('ends_at')
        .eq('club_id', club.id).eq('status', 'active')
        .order('starts_at', { ascending: false }).limit(1);
      if (!cancelled) setEndsAt(data?.[0]?.ends_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [club?.id, path]);

  const cd = useCountdown(endsAt);
  const subtitle = isAdmin ? 'Commissioner' : path.startsWith('/workouts/recap') ? 'Week Recap' : path.startsWith('/workouts/log') ? 'Freeform Log' : 'This Week';

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-xl"
      style={{ background: 'hsl(222 18% 7% / 0.78)', borderColor: 'hsl(24 40% 60% / 0.14)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center gap-2 h-12 px-2 max-w-[640px] lg:max-w-[1100px] mx-auto">
        <button type="button" onClick={() => isHub ? navigate('/compete') : navigate('/workouts')}
          aria-label={isHub ? 'Exit FORGE' : 'Back to FORGE'} className="fg-back">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <Link to="/workouts" className="flex-1 min-w-0 flex items-center gap-2.5">
          <span className="relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'radial-gradient(circle at 40% 30%, hsl(24 100% 55% / 0.4), transparent 70%), linear-gradient(135deg, hsl(220 14% 18%), hsl(222 18% 10%))', border: '1px solid hsl(24 95% 55% / 0.4)' }}>
            <Flame className="w-4 h-4" style={{ color: 'hsl(28 100% 66%)' }} />
          </span>
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-[13px] font-black uppercase tracking-[0.22em] truncate" style={{ color: 'hsl(30 40% 96%)' }}>FORGE</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] truncate" style={{ color: 'hsl(28 60% 62%)' }}>{subtitle}</p>
          </div>
        </Link>

        {endsAt && !cd.done && (
          <div className="fg-pill tabular-nums" title="Time left this week">
            <Timer className="w-3 h-3" /> {formatCountdownShort(cd)}
          </div>
        )}

        {isClubAdmin && !isAdmin && (
          <Link to="/workouts/admin" aria-label="Commissioner tools" className="fg-back">
            <Settings className="w-4 h-4" />
          </Link>
        )}
      </div>
    </header>
  );
}
