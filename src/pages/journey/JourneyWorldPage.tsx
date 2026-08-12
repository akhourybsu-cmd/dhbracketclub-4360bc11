import { useEffect, useMemo, useState } from 'react';
import { BookOpen, MapPin, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { JourneyLayout, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { useJourneyLibrary } from '@/hooks/useJourneyLibrary';
import { useJourneyRun } from '@/hooks/useJourneyRun';
import { NoRun } from './JourneyCharacterPage';

interface CodexRow { codex_key: string; title: string; category: string | null; body: string | null }
interface LocRow { location_key: string; name: string; region: string | null; description: string | null }
interface NpcRow { npc_key: string; name: string; title: string | null; description: string | null; codex_key: string | null }

/**
 * The Codex. Only shows what the player has actually discovered — unlocked
 * codex entries, visited locations, and NPCs already met. No spoilers.
 */
export default function JourneyWorldPage() {
  const { currentRun, loading } = useJourneyLibrary();
  const { run, state, loading: runLoading } = useJourneyRun(currentRun?.id);
  const [codex, setCodex] = useState<CodexRow[]>([]);
  const [locations, setLocations] = useState<LocRow[]>([]);
  const [npcs, setNpcs] = useState<NpcRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    (async () => {
      // World data comes from the run's pinned campaign version through a
      // controlled function — content tables are author-only.
      const { data } = await (supabase as any).rpc('journey_get_world', { _run_id: run.id });
      if (cancelled) return;
      setCodex((data?.codex ?? []) as CodexRow[]);
      setLocations((data?.locations ?? []) as LocRow[]);
      setNpcs((data?.npcs ?? []) as NpcRow[]);
    })();
    return () => { cancelled = true; };
  }, [run]);

  const unlockedCodex = useMemo(
    () => codex.filter((c) => (state.codex ?? []).includes(c.codex_key)),
    [codex, state.codex],
  );
  const visited = useMemo(
    () => locations.filter((l) => (state.visited_locations ?? []).includes(l.location_key)),
    [locations, state.visited_locations],
  );
  const met = useMemo(
    () => npcs.filter((n) => Boolean((state.npc_status ?? {})[n.npc_key]) || (state.relationships ?? {})[n.npc_key] !== undefined),
    [npcs, state.npc_status, state.relationships],
  );

  if (loading || runLoading) {
    return <JourneyLayout><div className="pt-6"><JourneySkeleton lines={6} /></div></JourneyLayout>;
  }
  if (!currentRun) return <JourneyLayout><NoRun /></JourneyLayout>;

  const total = codex.length + locations.length + npcs.length;
  const found = unlockedCodex.length + visited.length + met.length;

  return (
    <JourneyLayout>
      <header className="pt-2">
        <div className="jy-eyebrow">Codex</div>
        <h1 className="jy-display mt-1 text-2xl">Mesoplasia</h1>
        <p className="jy-muted mt-1 text-sm">{found} of {total} entries uncovered</p>
        <div className="jy-rule mt-4" />
      </header>

      <Group title="Lore" icon={BookOpen} empty="Nothing recorded yet.">
        {unlockedCodex.map((c) => (
          <Entry
            key={c.codex_key}
            id={c.codex_key}
            title={c.title}
            meta={c.category}
            body={c.body}
            open={open === c.codex_key}
            onToggle={() => setOpen(open === c.codex_key ? null : c.codex_key)}
          />
        ))}
      </Group>

      <Group title="Places" icon={MapPin} empty="You have travelled nowhere of note.">
        {visited.map((l) => (
          <Entry
            key={l.location_key}
            id={l.location_key}
            title={l.name}
            meta={l.region}
            body={l.description}
            open={open === l.location_key}
            onToggle={() => setOpen(open === l.location_key ? null : l.location_key)}
          />
        ))}
      </Group>

      <Group title="People" icon={Users} empty="You have met no one worth remembering.">
        {met.map((n) => (
          <Entry
            key={n.npc_key}
            id={n.npc_key}
            title={n.name}
            meta={n.title}
            body={n.description}
            open={open === n.npc_key}
            onToggle={() => setOpen(open === n.npc_key ? null : n.npc_key)}
          />
        ))}
      </Group>
    </JourneyLayout>
  );
}

function Group({
  title, icon: Icon, children, empty,
}: { title: string; icon: typeof BookOpen; children: React.ReactNode; empty: string }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="mt-5">
      <h2 className="jy-eyebrow flex items-center gap-1.5">
        <Icon className="h-3 w-3" aria-hidden /> {title}
      </h2>
      <div className="mt-2 space-y-2">
        {has ? children : <p className="jy-muted text-sm italic">{empty}</p>}
      </div>
    </section>
  );
}

function Entry({
  id, title, meta, body, open, onToggle,
}: { id: string; title: string; meta: string | null; body: string | null; open: boolean; onToggle: () => void }) {
  return (
    <div className="jy-panel overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
        aria-expanded={open}
        aria-controls={`jy-entry-${id}`}
        onClick={onToggle}
      >
        <span className="jy-display text-base">{title}</span>
        {meta && <span className="jy-chip shrink-0">{meta}</span>}
      </button>
      {open && body && (
        <div id={`jy-entry-${id}`} className="jy-prose border-t px-3 pb-3 pt-2 text-sm" style={{ borderColor: 'hsl(var(--jy-border-subtle))' }}>
          {body}
        </div>
      )}
    </div>
  );
}
