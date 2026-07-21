import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, VenetianMask, Sparkles, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import * as api from '@/lib/readshift/api';
import {
  MIN_ROUNDS, MAX_ROUNDS, DEFAULT_ROUNDS, MIN_PLAYERS, RECOMMENDED_MAX_PLAYERS,
} from '@/lib/readshift/constants';

const CATEGORIES = ['Everyday You', 'Unhinged Hypotheticals', 'Hot Takes', 'Throwbacks', 'Group Energy'];
const HOUR_CHOICES = [12, 24, 48, 72];

export default function CreateReadshiftPage() {
  const { user } = useAuth();
  const { club } = useClub();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [shiftHours, setShiftHours] = useState(24);
  const [readHours, setReadHours] = useState(24);
  const [earlyAdvance, setEarlyAdvance] = useState(true);
  const [promptMode, setPromptMode] = useState<'family' | 'adult'>('family');
  const [categories, setCategories] = useState<string[]>([]);
  const [allowCustom, setAllowCustom] = useState(false);
  const [revealExplanations, setRevealExplanations] = useState(true);
  const [strongReadExplanations, setStrongReadExplanations] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [loading, setLoading] = useState(false);

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !club || !name.trim()) return;
    setLoading(true);
    try {
      const game = await api.createGame({
        clubId: club.id, createdBy: user.id, name: name.trim(),
        totalRounds: rounds, shiftHours, readHours,
        earlyAdvance, promptMode, promptCategories: categories,
        allowCustomPrompts: allowCustom, allowRevealExplanations: revealExplanations,
        strongReadExplanations, remindersEnabled: reminders,
      });
      toast.success('Game created — invite your crew!');
      navigate(`/readshift/${game.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const Toggle = ({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <button type="button" onClick={() => onChange(!value)} className="w-full flex items-center justify-between gap-3 py-2 text-left">
      <span className="min-w-0">
        <span className="text-[13px] font-semibold block">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground/70 block leading-snug">{hint}</span>}
      </span>
      <span className={cn('relative w-10 h-6 rounded-full flex-shrink-0 transition-colors', value ? 'bg-primary' : 'bg-muted')}>
        <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', value ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );

  return (
    <div className="max-w-md mx-auto pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/readshift" className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="page-header mb-0 flex-1">
          <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))' }}>
            <VenetianMask className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div>
            <h1 className="page-header-title">New READSHIFT</h1>
            <p className="page-header-subtitle">Async social deduction</p>
          </div>
        </div>
      </div>

      <motion.form onSubmit={handleCreate} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="glass-card p-3.5 flex items-start gap-2.5" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.06), transparent 70%)' }}>
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
          <p className="text-[12px] text-muted-foreground/85 leading-snug">
            READSHIFT is <strong>asynchronous</strong> — players don't need to be online together. Each round runs through timed Shift, Read, and Reveal phases. Recommended {MIN_PLAYERS}–{RECOMMENDED_MAX_PLAYERS} players.
          </p>
        </div>

        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="form-label">Game name</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friday Night Reads" maxLength={80} className="form-input" />
          </div>

          <div>
            <label className="form-label flex items-baseline justify-between">
              <span>Rounds</span>
              <span className="text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/70">{rounds} rounds</span>
            </label>
            <div className="flex gap-2">
              {Array.from({ length: MAX_ROUNDS - MIN_ROUNDS + 1 }, (_, i) => MIN_ROUNDS + i).map((n) => (
                <button key={n} type="button" onClick={() => setRounds(n)}
                  className={cn('flex-1 py-2.5 rounded-xl text-sm font-extrabold transition-all btn-press',
                    rounds === n ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/50 text-muted-foreground')}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label flex items-center gap-1"><Clock className="w-3 h-3" /> Shift</label>
              <select value={shiftHours} onChange={(e) => setShiftHours(Number(e.target.value))} className="form-input">
                {HOUR_CHOICES.map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <div>
              <label className="form-label flex items-center gap-1"><Clock className="w-3 h-3" /> Read</label>
              <select value={readHours} onChange={(e) => setReadHours(Number(e.target.value))} className="form-input">
                {HOUR_CHOICES.map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Prompt mode</label>
            <div className="flex gap-2">
              {(['family', 'adult'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setPromptMode(m)}
                  className={cn('flex-1 py-2.5 rounded-xl text-[13px] font-bold capitalize transition-all btn-press',
                    promptMode === m ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}>
                  {m === 'family' ? 'Family-friendly' : 'Adult'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Prompt packs <span className="normal-case font-normal tracking-normal">(all if none picked)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => toggleCategory(c)}
                  className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors btn-press',
                    categories.includes(c) ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-muted/50 text-muted-foreground border border-transparent')}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border/20 pt-1 divide-y divide-border/15">
            <Toggle label="Advance early when everyone's done" hint="Skip the wait if all players finish before the deadline." value={earlyAdvance} onChange={setEarlyAdvance} />
            <Toggle label="Allow custom prompts" hint="Let the host add their own prompts." value={allowCustom} onChange={setAllowCustom} />
            <Toggle label="Reveal explanations" hint="Players may add an optional note at reveal." value={revealExplanations} onChange={setRevealExplanations} />
            <Toggle label="Strong Read explanations" hint="Let players justify their Strong Read." value={strongReadExplanations} onChange={setStrongReadExplanations} />
            <Toggle label="Reminders" hint="Nudge players before a phase deadline." value={reminders} onChange={setReminders} />
          </div>
        </div>

        <button type="submit" disabled={loading || !name.trim()}
          className="w-full h-12 rounded-xl font-bold btn-press flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed bg-primary text-primary-foreground">
          <Users className="w-4 h-4" /> {loading ? 'Creating…' : 'Create Game'}
        </button>
      </motion.form>
    </div>
  );
}
