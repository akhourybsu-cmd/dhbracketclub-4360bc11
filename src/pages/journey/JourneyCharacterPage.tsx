import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Package, Shield, Users } from 'lucide-react';
import { JourneyLayout, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { useJourneyLibrary } from '@/hooks/useJourneyLibrary';
import { useJourneyRun } from '@/hooks/useJourneyRun';
import { EMPTY_RUN_STATE } from '@/lib/journey/types';

/** Hero sheet for the active run: stats, health, inventory, bonds. */
export default function JourneyCharacterPage() {
  const { currentRun, heroes, loading } = useJourneyLibrary();
  const { run, state, loading: runLoading } = useJourneyRun(currentRun?.id);
  const hero = useMemo(
    () => heroes.find((h) => h.id === (run?.character_id ?? currentRun?.character_id)) ?? null,
    [heroes, run?.character_id, currentRun?.character_id],
  );
  const s = run ? state : EMPTY_RUN_STATE;

  if (loading || runLoading) {
    return <JourneyLayout><div className="pt-6"><JourneySkeleton lines={6} /></div></JourneyLayout>;
  }
  if (!currentRun) return <JourneyLayout><NoRun /></JourneyLayout>;

  const inventory = Object.entries(s.inventory ?? {}).filter(([, qty]) => qty > 0);
  const bonds = Object.entries(s.relationships ?? {});
  const factions = Object.entries(s.factions ?? {});

  return (
    <JourneyLayout>
      <header className="pt-2">
        <div className="jy-eyebrow">Hero</div>
        <h1 className="jy-display mt-1 text-2xl">{hero?.name ?? s.hero_name ?? 'Wanderer'}</h1>
        {hero?.origin && <p className="jy-secondary text-sm italic">{hero.origin}</p>}
        <div className="jy-rule mt-4" />
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(s.stats ?? {}).map(([k, v]) => (
          <div key={k} className="jy-panel p-3 text-center">
            <div className="jy-eyebrow">{k}</div>
            <div className="jy-display text-2xl" style={{ color: 'hsl(var(--jy-gold))' }}>{v}</div>
          </div>
        ))}
      </section>

      <section className="jy-panel mt-4 p-4">
        <div className="flex items-center justify-between">
          <span className="jy-eyebrow flex items-center gap-1.5">
            <Heart className="h-3 w-3" aria-hidden /> Vitality
          </span>
          <span className="jy-secondary text-sm">{s.health} / {s.max_health}</span>
        </div>
        <div className="jy-meter mt-2" role="progressbar" aria-valuenow={s.health} aria-valuemin={0} aria-valuemax={s.max_health}>
          <div className="jy-meter-fill" style={{ width: `${Math.max(0, Math.min(100, (s.health / Math.max(1, s.max_health)) * 100))}%` }} />
        </div>
        <div className="jy-muted mt-3 flex gap-4 text-xs">
          <span>Level {s.level}</span><span>{s.xp} XP</span><span>{s.gold} gold</span>
        </div>
      </section>

      <Panel title="Inventory" icon={Package} empty="You carry nothing of note." show={inventory.length > 0}>
        <ul className="space-y-1.5">
          {inventory.map(([key, qty]) => (
            <li key={key} className="jy-secondary flex justify-between text-sm">
              <span>{key}</span>{qty > 1 && <span className="jy-muted">×{qty}</span>}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Bonds" icon={Users} empty="No bonds forged yet." show={bonds.length > 0}>
        <ul className="space-y-1.5">
          {bonds.map(([key, value]) => (
            <li key={key} className="jy-secondary flex justify-between text-sm">
              <span>{key}</span><span className="jy-muted">{value > 0 ? `+${value}` : value}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Standing" icon={Shield} empty="No faction has taken notice of you." show={factions.length > 0}>
        <ul className="space-y-1.5">
          {factions.map(([key, value]) => (
            <li key={key} className="jy-secondary flex justify-between text-sm">
              <span>{key}</span><span className="jy-muted">{value > 0 ? `+${value}` : value}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {(s.traits?.length > 0 || s.abilities?.length > 0) && (
        <section className="mt-4 flex flex-wrap gap-2">
          {s.traits.map((t) => <span key={t} className="jy-chip jy-chip-gold">{t}</span>)}
          {s.abilities.map((a) => <span key={a} className="jy-chip">{a}</span>)}
        </section>
      )}
    </JourneyLayout>
  );
}

function Panel({
  title, icon: Icon, children, empty, show,
}: { title: string; icon: typeof Package; children: React.ReactNode; empty: string; show: boolean }) {
  return (
    <section className="jy-panel mt-4 p-4">
      <h2 className="jy-eyebrow flex items-center gap-1.5">
        <Icon className="h-3 w-3" aria-hidden /> {title}
      </h2>
      <div className="mt-2.5">{show ? children : <p className="jy-muted text-sm italic">{empty}</p>}</div>
    </section>
  );
}

export function NoRun() {
  return (
    <div className="jy-panel mt-6 p-6 text-center">
      <p className="jy-secondary text-sm">You have no journey underway.</p>
      <Link className="jy-btn jy-btn-primary mt-3" to="/journey">Choose a campaign</Link>
    </div>
  );
}
