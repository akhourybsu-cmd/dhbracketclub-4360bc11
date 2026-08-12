import { useEffect, useState } from 'react';
import { ScrollText, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { JourneyLayout, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { useJourneyLibrary } from '@/hooks/useJourneyLibrary';
import { useJourneyRun } from '@/hooks/useJourneyRun';
import { NoRun } from './JourneyCharacterPage';
import type { QuestState } from '@/lib/journey/types';

interface QuestMeta { quest_key: string; title: string; description: string | null; quest_type: string }
interface HistoryRow { id: string; choice_key: string; scene_key: string; choice_text: string | null; created_at: string }

/** Quest log + the record of decisions already made. */
export default function JourneyJournalPage() {
  const { currentRun, loading } = useJourneyLibrary();
  const { run, state, loading: runLoading } = useJourneyRun(currentRun?.id);
  const [quests, setQuests] = useState<QuestMeta[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [tab, setTab] = useState<'quests' | 'decisions'>('quests');

  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    (async () => {
      const [q, h] = await Promise.all([
        (supabase as any).from('journey_quests').select('quest_key,title,description,quest_type').eq('campaign_id', run.campaign_id),
        (supabase as any).from('journey_run_choice_history').select('id,choice_key,scene_key,choice_text,created_at')
          .eq('run_id', run.id).order('created_at', { ascending: false }).limit(200),
      ]);
      if (cancelled) return;
      setQuests((q?.data ?? []) as QuestMeta[]);
      setHistory((h?.data ?? []) as HistoryRow[]);
    })();
    return () => { cancelled = true; };
  }, [run]);

  if (loading || runLoading) {
    return <JourneyLayout><div className="pt-6"><JourneySkeleton lines={6} /></div></JourneyLayout>;
  }
  if (!currentRun) return <JourneyLayout><NoRun /></JourneyLayout>;

  const questStates = (state.quests ?? {}) as Record<string, QuestState>;
  const known = quests.filter((q) => questStates[q.quest_key] && questStates[q.quest_key].status !== 'not_started');

  return (
    <JourneyLayout>
      <header className="pt-2">
        <div className="jy-eyebrow">Journal</div>
        <h1 className="jy-display mt-1 text-2xl">The Record</h1>
        <div className="jy-rule mt-4" />
      </header>

      <div className="mt-4 flex gap-2" role="tablist">
        {(['quests', 'decisions'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`jy-btn jy-btn-sm ${tab === t ? 'jy-btn-primary' : 'jy-btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'quests' ? 'Quests' : 'Decisions'}
          </button>
        ))}
      </div>

      {tab === 'quests' ? (
        <section className="mt-4 space-y-3">
          {known.length === 0 ? (
            <EmptyNote text="No quests have found you yet." />
          ) : known.map((q) => {
            const st = questStates[q.quest_key];
            const Icon = st.status === 'completed' ? CheckCircle2 : st.status === 'failed' ? XCircle : Circle;
            const color = st.status === 'completed' ? 'hsl(150 30% 60%)'
              : st.status === 'failed' ? 'hsl(var(--jy-blood))' : 'hsl(var(--jy-gold))';
            return (
              <article key={q.quest_key} className="jy-panel p-4">
                <div className="flex items-start gap-2">
                  <Icon className="mt-1 h-4 w-4 shrink-0" style={{ color }} aria-hidden />
                  <div className="min-w-0">
                    <h2 className="jy-display text-base">{q.title}</h2>
                    {q.description && <p className="jy-prose mt-1 text-sm">{q.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="jy-chip">{q.quest_type}</span>
                      <span className="jy-chip">{st.status}</span>
                      {st.step && <span className="jy-chip jy-chip-gold">{st.step}</span>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="mt-4 space-y-2">
          {history.length === 0 ? (
            <EmptyNote text="No decisions recorded yet." />
          ) : history.map((h) => (
            <div key={h.id} className="jy-panel p-3">
              <p className="jy-secondary text-sm">{h.choice_text ?? h.choice_key}</p>
              <p className="jy-muted mt-1 text-xs">
                {h.scene_key} · {new Date(h.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </section>
      )}
    </JourneyLayout>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="jy-panel p-6 text-center">
      <ScrollText className="mx-auto mb-2 h-5 w-5" style={{ color: 'hsl(var(--jy-gold))' }} aria-hidden />
      <p className="jy-muted text-sm italic">{text}</p>
    </div>
  );
}
