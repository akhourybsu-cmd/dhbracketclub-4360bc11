// DH Club — Narrative RPG · Game Master Console
//
// Portaled side-drawer with the GM's full toolkit organized into tabs:
//   Scene · NPCs · Clues · Items · Factions · Clocks · Memory · Notes · AI
// Players never see this drawer — visibility is enforced by both the
// caller and RLS on each underlying table.
//
// AI Tools tab calls the typed stubs in lib/narrative/aiService — when
// no provider is configured, each button shows a clear "AI not
// configured" message instead of failing silently.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING_SOFT } from '@/lib/narrative/motion';
import {
  X, Megaphone, Users, KeyRound, Backpack, ShieldAlert, Clock as ClockIcon,
  BookOpenText, StickyNote, Sparkles, PlusCircle, Bookmark, Pencil,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { StatusPill } from '@/components/ui/status-pill';
import { ClockCard } from './ClockCard';
import {
  EntityEditSheet, NPC_SCHEMA, CLUE_SCHEMA, ITEM_SCHEMA, FACTION_SCHEMA,
  CLOCK_SCHEMA, SCENE_SCHEMA,
} from './EntityEditSheet';
import { ChapterSheet } from './ChapterSheet';
import { SceneSummaryWizard } from './SceneSummaryWizard';
import { isAiConfigured } from '@/lib/narrative/aiService';
import { isFlamingoCampaign, FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { FlamingoClueMarker, clueAccent, FlamingoMeter, FlamingoLockIcon } from './flamingo/FlamingoPrimitives';
import { WritersRoomPanel } from './WritersRoomPanel';
import type {
  Campaign, Scene, NPC, Clue, Faction, Clock, Item, Location as NarrativeLocation, AiSuggestionRow,
} from '@/lib/narrative/types';

type TabKey = 'scene' | 'chapters' | 'npcs' | 'clues' | 'items' | 'factions' | 'clocks' | 'memory' | 'notes' | 'ai';

const TABS: { key: TabKey; label: string; icon: typeof Megaphone }[] = [
  { key: 'scene',    label: 'Scene',    icon: Megaphone },
  { key: 'chapters', label: 'Chapters', icon: Bookmark },
  { key: 'npcs',     label: 'NPCs',     icon: Users },
  { key: 'clues',    label: 'Clues',    icon: KeyRound },
  { key: 'items',    label: 'Items',    icon: Backpack },
  { key: 'factions', label: 'Factions', icon: ShieldAlert },
  { key: 'clocks',   label: 'Clocks',   icon: ClockIcon },
  { key: 'memory',   label: 'Memory',   icon: BookOpenText },
  { key: 'notes',    label: 'Notes',    icon: StickyNote },
  { key: 'ai',       label: 'AI',       icon: Sparkles },
];

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  currentScene: Scene | null;
  scenes: Scene[];
  npcs: NPC[];
  clues: Clue[];
  items: Item[];
  factions: Faction[];
  clocks: Clock[];
  locations: NarrativeLocation[];
  aiSuggestions: AiSuggestionRow[];
  onCreateScene: (input: { title: string; location?: string; stakes?: string; objective?: string; public_notes?: string; gm_notes?: string }) => Promise<unknown>;
  onEndScene: (sceneId: string) => Promise<unknown>;
  onAdvanceClock: (clockId: string, delta: number, note?: string) => Promise<unknown>;
  onCreateClock: (input: { name: string; description?: string; max_value: number; clock_type: Clock['clock_type']; visibility: 'public' | 'gm_only' }) => Promise<unknown>;
  onCreateNpc: (input: { name: string; role?: string; description?: string; visibility?: 'public' | 'gm_only' }) => Promise<unknown>;
  onCreateClue: (input: { name: string; description?: string; visibility?: 'public' | 'gm_only'; importance?: 'low' | 'normal' | 'high' }) => Promise<unknown>;
  onCreateFaction: (input: { name: string; description?: string; visibility?: 'public' | 'gm_only' }) => Promise<unknown>;
  onCreateItem: (input: { name: string; description?: string; visibility?: 'public' | 'gm_only' }) => Promise<unknown>;
  /** Called after the GM applies a state-update set so parent can refresh. */
  onChanged?: () => void;
  /** Initial tab to focus on open. Used by the Quick Actions bar so
   *  "Writer's Room" / "Clocks" / "NPCs" buttons open the console
   *  pre-routed to the right surface. Changes after mount are honored
   *  whenever `open` flips from false → true. */
  initialTab?: TabKey;
}

export function GMConsoleSheet(props: Props) {
  const { open, onClose, campaign, initialTab } = props;
  const flamingo = isFlamingoCampaign(campaign.template_key);
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'scene');

  // Reset the active tab to `initialTab` each time the sheet re-opens
  // so the Quick Actions bar's pre-routed entry point actually lands
  // on the right tab even if the GM previously closed the console on
  // a different tab.
  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);
  const [editTarget, setEditTarget] = useState<{ table: string; label: string; row: any; schema: any } | null>(null);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  if (!open || typeof document === 'undefined') return null;

  // Flamingo Protocol relabels the Items tab as "Leverage" so the GM
  // reads it as story-currency, not generic loot. Tab order is identical
  // so the per-tab dispatch below still keys off the original TabKey.
  const tabsForRender = flamingo
    ? TABS.map(t => {
        if (t.key === 'items') return { ...t, label: 'Leverage' };
        if (t.key === 'ai') return { ...t, label: "Writer's" };
        return t;
      })
    : TABS;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div className="flex-1" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%', transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
        transition={SPRING_SOFT}
        onClick={e => e.stopPropagation()}
        className="w-full sm:w-[420px] h-full flex flex-col border-l overflow-hidden relative"
        style={
          flamingo
            ? {
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: `
                  radial-gradient(60% 35% at 50% 0%, hsl(${FLAMINGO.pink} / 0.18), transparent 70%),
                  radial-gradient(50% 40% at 100% 100%, hsl(${FLAMINGO.cyan} / 0.12), transparent 70%),
                  linear-gradient(180deg, hsl(${FLAMINGO.midnight}), hsl(${FLAMINGO.ink}))
                `,
                borderColor: `hsl(${FLAMINGO.pink} / 0.35)`,
                color: `hsl(${FLAMINGO.paper})`,
              }
            : {
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border) / 0.4)',
              }
        }
      >
        {/* Top neon edge — Flamingo only */}
        {flamingo && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}), transparent)`,
              opacity: 0.75,
            }}
          />
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: flamingo ? `hsl(${FLAMINGO.pink} / 0.25)` : 'hsl(var(--border) / 0.25)' }}
        >
          <div>
            <p
              className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--muted-foreground) / 0.7)' }}
            >
              {flamingo ? "Director's Table" : 'Game Master'}
            </p>
            <h2
              className="text-[15px] font-extrabold tracking-tight"
              style={flamingo ? {
                backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${FLAMINGO.pink}))`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              } : undefined}
            >
              {flamingo ? 'Run the chaos' : 'GM Console'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-lg active:scale-90 flex items-center justify-center"
            style={flamingo ? {
              background: `hsl(${FLAMINGO.ink})`,
              border: `1px solid hsl(${FLAMINGO.pink} / 0.4)`,
              color: `hsl(${FLAMINGO.paper})`,
            } : {
              background: 'hsl(var(--muted) / 0.4)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab strip */}
        <div
          className="px-2 py-2 border-b flex-shrink-0 overflow-x-auto"
          style={{
            scrollbarWidth: 'none',
            borderColor: flamingo ? `hsl(${FLAMINGO.pink} / 0.15)` : 'hsl(var(--border) / 0.15)',
            background: flamingo ? `hsl(${FLAMINGO.midnight} / 0.5)` : undefined,
          }}
        >
          <div className="flex gap-1">
            {tabsForRender.map(t => {
              const Icon = t.icon;
              const selected = tab === t.key;
              const flamingoStyle = selected
                ? {
                    background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.25), hsl(${FLAMINGO.violet} / 0.15))`,
                    border: `1px solid hsl(${FLAMINGO.pink} / 0.55)`,
                    color: `hsl(${FLAMINGO.paper})`,
                    boxShadow: `0 0 10px -3px hsl(${FLAMINGO.pink} / 0.55)`,
                  }
                : {
                    background: `hsl(${FLAMINGO.ink} / 0.7)`,
                    border: `1px solid hsl(${FLAMINGO.paper} / 0.15)`,
                    color: `hsl(${FLAMINGO.paper} / 0.7)`,
                  };
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex-shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider transition ${
                    flamingo
                      ? ''
                      : selected
                        ? 'bg-primary/15 text-primary border border-primary/35'
                        : 'bg-muted/25 border border-border/40 text-muted-foreground/75'
                  }`}
                  style={flamingo ? flamingoStyle : undefined}
                >
                  <Icon className="w-3 h-3" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content — AnimatePresence crossfade between tabs gives
            the drawer a deliberate feel instead of snap-switching. */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === 'scene'    && <SceneTab {...props} onEditScene={(s) => setEditTarget({ table: 'narrative_scenes', label: 'Edit scene', row: s, schema: SCENE_SCHEMA })} />}
              {tab === 'chapters' && <ChaptersTab flamingo={flamingo} onOpenChapters={() => setChaptersOpen(true)} />}
              {tab === 'npcs'     && <NpcsTab     {...props} onEdit={(n) => setEditTarget({ table: 'narrative_npcs',     label: 'Edit NPC',     row: n, schema: NPC_SCHEMA })} />}
              {tab === 'clues'    && <CluesTab    {...props} onEdit={(c) => setEditTarget({ table: 'narrative_clues',    label: 'Edit clue',    row: c, schema: CLUE_SCHEMA })} />}
              {tab === 'items'    && <ItemsTab    {...props} onEdit={(i) => setEditTarget({ table: 'narrative_items',    label: 'Edit item',    row: i, schema: ITEM_SCHEMA })} />}
              {tab === 'factions' && <FactionsTab {...props} onEdit={(f) => setEditTarget({ table: 'narrative_factions', label: 'Edit faction', row: f, schema: FACTION_SCHEMA })} />}
              {tab === 'clocks'   && <ClocksTab   {...props} onEdit={(c) => setEditTarget({ table: 'narrative_clocks',   label: 'Edit clock',   row: c, schema: CLOCK_SCHEMA })} />}
              {tab === 'memory'   && <MemoryTab   {...props} onSummarize={() => setSummaryOpen(true)} />}
              {tab === 'notes'    && <NotesTab    {...props} />}
              {tab === 'ai'       && <WritersRoomPanel campaign={props.campaign} currentScene={props.currentScene} npcs={props.npcs} clues={props.clues} onChanged={props.onChanged} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Edit sheet — opens over the console for the row tapped. */}
        {editTarget && (
          <EntityEditSheet
            open
            onClose={() => setEditTarget(null)}
            table={editTarget.table}
            entityLabel={editTarget.label}
            row={editTarget.row}
            schema={editTarget.schema}
            onSaved={() => { setEditTarget(null); props.onChanged?.(); }}
          />
        )}

        {/* Chapter management drawer */}
        <ChapterSheet
          open={chaptersOpen}
          onClose={() => setChaptersOpen(false)}
          campaign={props.campaign}
          onChanged={props.onChanged}
        />

        {/* Scene summary wizard */}
        <SceneSummaryWizard
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          campaign={props.campaign}
          currentScene={props.currentScene}
          onApplied={props.onChanged}
        />
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ─── Scene tab ───────────────────────────────────────────────── */

function SceneTab({ campaign, currentScene, onCreateScene, onEndScene, onEditScene }: Props & { onEditScene?: (s: Scene) => void }) {
  const flamingo = isFlamingoCampaign(campaign.template_key);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [objective, setObjective] = useState('');
  const [stakes, setStakes] = useState('');
  const [publicNotes, setPublicNotes] = useState('');
  const [gmNotes, setGmNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error('Give the scene a title.'); return; }
    setBusy(true);
    try {
      const result = await onCreateScene({
        title: title.trim(),
        location: location.trim() || undefined,
        objective: objective.trim() || undefined,
        stakes: stakes.trim() || undefined,
        public_notes: publicNotes.trim() || undefined,
        gm_notes: gmNotes.trim() || undefined,
      });
      if (result) {
        setTitle(''); setLocation(''); setObjective(''); setStakes(''); setPublicNotes(''); setGmNotes('');
        toast.success('Scene started.');
      } else {
        toast.error("Couldn't start the scene. Make sure the campaign is active and you're the GM.");
      }
    } catch (e) {
      toast.error(`Couldn't start scene: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      // Always clear — fixes the permanent-loading bug where a thrown
      // error from the mutator left this button disabled forever.
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {currentScene && (
        <div
          className="rounded-2xl p-3 relative overflow-hidden"
          style={flamingo ? {
            background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
            border: `1px solid hsl(${FLAMINGO.pink} / 0.45)`,
            boxShadow: `0 0 14px -6px hsl(${FLAMINGO.pink} / 0.5)`,
            color: `hsl(${FLAMINGO.paper})`,
          } : {
            background: 'hsl(var(--gold) / 0.06)',
            border: '1px solid hsl(var(--gold) / 0.3)',
          }}
        >
          {flamingo && (
            <div aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `linear-gradient(180deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}))` }} />
          )}
          <div className={flamingo ? 'pl-2' : ''}>
            <p
              className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--gold))' }}
            >
              {flamingo ? 'Now filming' : 'Active scene'}
            </p>
            <h3 className="text-[14px] font-extrabold tracking-tight mt-0.5">{currentScene.title}</h3>
            {currentScene.objective && (
              <p
                className="text-[11px] mt-1"
                style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.85)` : 'hsl(var(--foreground) / 0.8)' }}
              >
                {currentScene.objective}
              </p>
            )}
          </div>
          <div className="mt-3 flex gap-1.5">
            {onEditScene && (
              <button
                type="button"
                onClick={() => onEditScene(currentScene)}
                className="flex-1 h-9 rounded-lg bg-muted/40 border border-border/40 text-[11px] font-extrabold uppercase tracking-wider active:scale-[0.98] transition inline-flex items-center justify-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => onEndScene(currentScene.id)}
              className="flex-1 h-9 rounded-lg bg-muted/40 border border-border/40 text-[11px] font-extrabold uppercase tracking-wider active:scale-[0.98] transition"
            >
              End scene
            </button>
          </div>
        </div>
      )}

      <div>
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-2"
          style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--muted-foreground) / 0.7)' }}
        >
          {flamingo ? 'Roll a new scene' : 'Start a new scene'}
        </p>
        <div className="space-y-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Scene title" className="h-10" />
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="h-10" />
          <Input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Current objective" className="h-10" />
          <Input value={stakes} onChange={e => setStakes(e.target.value)} placeholder="Stakes" className="h-10" />
          <Textarea value={publicNotes} onChange={e => setPublicNotes(e.target.value)} placeholder="Public notes (players see this)" rows={2} className="text-[12.5px]" />
          <Textarea value={gmNotes} onChange={e => setGmNotes(e.target.value)} placeholder="GM-only notes (private to you)" rows={2} className="text-[12.5px]" />
          <button
            onClick={submit}
            disabled={busy}
            className="w-full h-10 rounded-lg text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            style={flamingo ? {
              background: `linear-gradient(135deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.violet}))`,
              color: `hsl(${FLAMINGO.paper})`,
              boxShadow: `0 0 14px -3px hsl(${FLAMINGO.pink} / 0.6)`,
              border: `1px solid hsl(${FLAMINGO.pink} / 0.7)`,
            } : {
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
              color: 'hsl(var(--primary-foreground))',
            }}
          >
            <PlusCircle className="w-3.5 h-3.5" /> {flamingo ? 'Roll sound' : 'Start scene'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── NPCs / Clues / Items / Factions / Locations ────────────────
 * Reusable simple-create pattern: short form at top, list below. */

function SimpleCreate({ label, onCreate, placeholder, descPlaceholder, gmOnly = false }: {
  label: string;
  onCreate: (input: { name: string; description?: string; visibility?: 'public' | 'gm_only' }) => Promise<unknown>;
  placeholder: string;
  descPlaceholder?: string;
  /** When true, default visibility is gm_only (hidden from players). */
  gmOnly?: boolean;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [hidden, setHidden] = useState(gmOnly);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const result = await onCreate({ name: name.trim(), description: desc.trim() || undefined, visibility: hidden ? 'gm_only' : 'public' });
      // Mutators return null on RLS failure / DB error — only clear
      // the form when the insert actually persisted. Otherwise the
      // user's input is preserved so they can retry without retyping.
      if (result) {
        setName(''); setDesc('');
      } else {
        toast.error(`Couldn't add the ${label}. You may not have permission, or the campaign isn't active yet.`);
      }
    } catch (e) {
      toast.error(`Couldn't add: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      // ALWAYS clear busy — even if the await above rejects. Closes
      // the "permanent loading state" bug where a thrown error left
      // the Add button disabled forever.
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl bg-muted/25 border border-border/40 p-3 space-y-2">
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">Add {label}</p>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} className="h-10" />
      {descPlaceholder && (
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder={descPlaceholder} rows={2} className="text-[12px]" />
      )}
      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-muted-foreground/85">
          <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> GM-only
        </label>
        <button onClick={submit} disabled={busy || !name.trim()} className="h-9 px-3 rounded-md text-[11px] font-extrabold inline-flex items-center gap-1 active:scale-95 transition disabled:opacity-50" style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.35)' }}>
          <PlusCircle className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}

function NpcsTab({ campaign, npcs, onCreateNpc, onEdit }: Props & { onEdit?: (n: NPC) => void }) {
  const flamingo = isFlamingoCampaign(campaign.template_key);
  return (
    <div className="space-y-3">
      <SimpleCreate label="NPC" onCreate={onCreateNpc as any} placeholder="NPC name" descPlaceholder="Short description / role" />
      <div className="space-y-1.5">
        {npcs.length === 0 && <EmptyHint message="No NPCs yet." />}
        {npcs.map(n => (
          <button
            type="button"
            key={n.id}
            onClick={() => onEdit?.(n)}
            className="w-full text-left rounded-xl p-2.5 flex items-start gap-2 active:scale-[0.99] transition relative overflow-hidden"
            style={flamingo ? {
              background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
              border: `1px solid hsl(${FLAMINGO.gold} / 0.35)`,
              color: `hsl(${FLAMINGO.paper})`,
            } : {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border) / 0.4)',
            }}
          >
            {flamingo && (
              <div aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `hsl(${FLAMINGO.gold})` }} />
            )}
            <div className={`min-w-0 flex-1 ${flamingo ? 'pl-2' : ''}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-extrabold leading-tight line-clamp-2 break-words flex-1 min-w-0">{n.name}</span>
                {n.visibility === 'gm_only' && (flamingo ? <FlamingoLockIcon /> : <StatusPill variant="disabled" size="xs">GM only</StatusPill>)}
              </div>
              {n.role && (
                <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: flamingo ? `hsl(${FLAMINGO.gold})` : 'hsl(var(--muted-foreground) / 0.65)' }}>
                  {n.role}
                </p>
              )}
              {n.description && (
                <p
                  className="text-[11.5px] leading-snug mt-1"
                  style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.8)` : 'hsl(var(--foreground) / 0.8)' }}
                >
                  {n.description}
                </p>
              )}
            </div>
            <Pencil className="w-3 h-3 mt-1 flex-shrink-0" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.5)` : 'hsl(var(--muted-foreground) / 0.55)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CluesTab({ campaign, clues, onCreateClue, onEdit }: Props & { onEdit?: (c: Clue) => void }) {
  const flamingo = isFlamingoCampaign(campaign.template_key);
  return (
    <div className="space-y-3">
      <SimpleCreate label="clue" onCreate={onCreateClue as any} placeholder="Clue name" descPlaceholder="What the clue tells the party" />
      <div className="space-y-1.5">
        {clues.length === 0 && <EmptyHint message="No clues discovered yet." />}
        {clues.map(c => (
          <button
            type="button"
            key={c.id}
            onClick={() => onEdit?.(c)}
            className="w-full text-left rounded-xl p-2.5 flex items-start gap-2 active:scale-[0.99] transition relative overflow-hidden"
            style={flamingo ? {
              background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
              border: `1px solid hsl(${clueAccent(c.status)} / 0.4)`,
              color: `hsl(${FLAMINGO.paper})`,
            } : {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border) / 0.4)',
            }}
          >
            {flamingo && (
              <div
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: `hsl(${clueAccent(c.status)})` }}
              />
            )}
            {flamingo && <FlamingoClueMarker status={c.status} />}
            <div className={`min-w-0 flex-1 ${flamingo ? 'pl-1' : ''}`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12.5px] font-extrabold leading-tight line-clamp-2 break-words flex-1 min-w-0">{c.name}</span>
                {!flamingo && (
                  <StatusPill variant={c.status === 'solved' ? 'success' : c.status === 'false_lead' ? 'danger' : c.status === 'partial' ? 'warning' : 'info'} size="xs">
                    {c.status.replace('_', ' ')}
                  </StatusPill>
                )}
                {c.visibility === 'gm_only' && (flamingo ? <FlamingoLockIcon /> : <StatusPill variant="disabled" size="xs">GM only</StatusPill>)}
              </div>
              {c.description && (
                <p
                  className="text-[11.5px] leading-snug mt-1"
                  style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.8)` : 'hsl(var(--foreground) / 0.8)' }}
                >
                  {c.description}
                </p>
              )}
            </div>
            <Pencil className="w-3 h-3 mt-1 flex-shrink-0" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.5)` : 'hsl(var(--muted-foreground) / 0.55)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ItemsTab({ campaign, items, onCreateItem, onEdit }: Props & { onEdit?: (i: Item) => void }) {
  const flamingo = isFlamingoCampaign(campaign.template_key);
  return (
    <div className="space-y-3">
      <SimpleCreate
        label={flamingo ? 'leverage' : 'item'}
        onCreate={onCreateItem as any}
        placeholder={flamingo ? 'Leverage name' : 'Item name'}
        descPlaceholder={flamingo ? 'Useful for…' : 'Description / use'}
      />
      <div className="space-y-1.5">
        {items.length === 0 && <EmptyHint message={flamingo ? 'No leverage on the table yet.' : 'No important items yet.'} />}
        {items.map(i => (
          <button
            type="button"
            key={i.id}
            onClick={() => onEdit?.(i)}
            className="w-full text-left rounded-xl p-2.5 flex items-start gap-2 active:scale-[0.99] transition relative overflow-hidden"
            style={flamingo ? {
              background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
              border: `1px solid hsl(${FLAMINGO.gold} / 0.4)`,
              color: `hsl(${FLAMINGO.paper})`,
            } : {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border) / 0.4)',
            }}
          >
            {flamingo && (
              <div
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: `hsl(${FLAMINGO.gold})` }}
              />
            )}
            <div className={`min-w-0 flex-1 ${flamingo ? 'pl-2' : ''}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-extrabold leading-tight line-clamp-2 break-words flex-1 min-w-0">{i.name}</span>
                {i.visibility === 'gm_only' && (flamingo ? <FlamingoLockIcon /> : <StatusPill variant="disabled" size="xs">GM only</StatusPill>)}
              </div>
              {i.description && (
                <p
                  className="text-[11.5px] leading-snug mt-1"
                  style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.8)` : 'hsl(var(--foreground) / 0.8)' }}
                >
                  {i.description}
                </p>
              )}
            </div>
            <Pencil className="w-3 h-3 mt-1 flex-shrink-0" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.5)` : 'hsl(var(--muted-foreground) / 0.55)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function FactionsTab({ campaign, factions, onCreateFaction, onEdit }: Props & { onEdit?: (f: Faction) => void }) {
  const flamingo = isFlamingoCampaign(campaign.template_key);
  return (
    <div className="space-y-3">
      <SimpleCreate label="faction" onCreate={onCreateFaction as any} placeholder="Faction name" descPlaceholder="Who they are, what they want" />
      <div className="space-y-1.5">
        {factions.length === 0 && <EmptyHint message="No factions have entered the story yet." />}
        {factions.map(f => (
          <button
            type="button"
            key={f.id}
            onClick={() => onEdit?.(f)}
            className="w-full text-left rounded-xl p-2.5 active:scale-[0.99] transition relative overflow-hidden"
            style={flamingo ? {
              background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
              border: `1px solid hsl(${FLAMINGO.violet} / 0.4)`,
              color: `hsl(${FLAMINGO.paper})`,
            } : {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border) / 0.4)',
            }}
          >
            {flamingo && (
              <div
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: `hsl(${FLAMINGO.violet})` }}
              />
            )}
            <div className={flamingo ? 'pl-2' : ''}>
              <div className="flex items-center gap-1.5 justify-between">
                <span className="text-[12.5px] font-extrabold leading-tight line-clamp-2 break-words flex-1 min-w-0">{f.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {f.visibility === 'gm_only' && (flamingo ? <FlamingoLockIcon /> : <StatusPill variant="disabled" size="xs">GM only</StatusPill>)}
                  <Pencil className="w-3 h-3" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.5)` : 'hsl(var(--muted-foreground) / 0.55)' }} />
                </div>
              </div>
              {flamingo ? (
                <div className="mt-2 space-y-1.5">
                  <FlamingoMeter label="Heat" value={f.suspicion_score ?? 0} max={10} accent="heat" />
                  <FlamingoMeter label="Bond" value={f.relationship_score ?? 0} max={10} accent="cool" />
                </div>
              ) : (
                <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">
                  Relationship <span className="tabular-nums">{f.relationship_score}</span> · Suspicion <span className="tabular-nums">{f.suspicion_score}</span>
                </p>
              )}
              {f.description && (
                <p
                  className="text-[11.5px] leading-snug mt-1.5"
                  style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.8)` : 'hsl(var(--foreground) / 0.8)' }}
                >
                  {f.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ClocksTab({ campaign, clocks, onCreateClock, onAdvanceClock, onEdit }: Props & { onEdit?: (c: Clock) => void }) {
  const flamingo = isFlamingoCampaign(campaign.template_key);
  const [name, setName] = useState('');
  const [maxVal, setMaxVal] = useState(6);
  const [clockType, setClockType] = useState<Clock['clock_type']>('danger');
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div
        className="rounded-xl p-3 space-y-2"
        style={flamingo ? {
          background: `hsl(${FLAMINGO.ink} / 0.7)`,
          border: `1px solid hsl(${FLAMINGO.danger} / 0.35)`,
          color: `hsl(${FLAMINGO.paper})`,
        } : {
          background: 'hsl(var(--muted) / 0.25)',
          border: '1px solid hsl(var(--border) / 0.4)',
        }}
      >
        <p
          className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: flamingo ? `hsl(${FLAMINGO.danger})` : 'hsl(var(--muted-foreground) / 0.7)' }}
        >
          {flamingo ? 'Wind a new clock' : 'Add clock'}
        </p>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Clock name" className="h-10" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">Segments</Label>
            <Input type="number" value={maxVal} min={2} max={20} onChange={e => setMaxVal(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 6)))} className="mt-1 h-9 text-center" />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">Type</Label>
            <select value={clockType} onChange={e => setClockType(e.target.value as Clock['clock_type'])} className="mt-1 w-full h-9 rounded-md border border-border/40 bg-card px-2 text-[12px]">
              <option value="danger">Danger</option>
              <option value="opportunity">Opportunity</option>
              <option value="mystery">Mystery</option>
              <option value="faction">Faction</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-muted-foreground/85">
            <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> GM-only
          </label>
          <button
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await onCreateClock({ name: name.trim(), max_value: maxVal, clock_type: clockType, visibility: hidden ? 'gm_only' : 'public' });
                if (result) {
                  setName(''); setMaxVal(6); setHidden(false);
                } else {
                  toast.error("Couldn't add the clock. Check that the campaign is active.");
                }
              } catch (e) {
                toast.error(`Couldn't add clock: ${(e as Error).message ?? 'unknown error'}`);
              } finally {
                setBusy(false);
              }
            }}
            className="h-9 px-3 rounded-md text-[11px] font-extrabold active:scale-95 disabled:opacity-50"
            style={flamingo ? {
              background: `linear-gradient(135deg, hsl(${FLAMINGO.danger} / 0.3), hsl(${FLAMINGO.pink} / 0.2))`,
              color: `hsl(${FLAMINGO.paper})`,
              border: `1px solid hsl(${FLAMINGO.danger} / 0.55)`,
              boxShadow: `0 0 10px -3px hsl(${FLAMINGO.danger} / 0.5)`,
            } : {
              background: 'hsl(var(--primary) / 0.18)',
              color: 'hsl(var(--primary))',
              border: '1px solid hsl(var(--primary) / 0.35)',
            }}
          >
            Add clock
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {clocks.length === 0 && <EmptyHint message="No clocks yet." />}
        {clocks.map(c => (
          <div key={c.id} className="relative">
            <ClockCard clock={c} showVisibility onAdvance={delta => onAdvanceClock(c.id, delta)} />
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(c)}
                aria-label="Edit clock"
                className="absolute top-2 right-2 w-7 h-7 rounded-md bg-muted/30 border border-border/40 text-muted-foreground/65 active:scale-90 flex items-center justify-center"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Chapters tab — just a launcher into the chapter sheet ── */

function ChaptersTab({ flamingo, onOpenChapters }: { flamingo: boolean; onOpenChapters: () => void }) {
  return (
    <div className="space-y-3">
      <p
        className="text-[12px] leading-relaxed"
        style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.85)` : 'hsl(var(--foreground) / 0.85)' }}
      >
        {flamingo
          ? 'Group scenes into chapters — each one is an episode of the show. Starting a chapter posts a title card to story chat so async players see the structure.'
          : 'Group scenes into chapters — major story arcs. Starting a chapter posts a transition into the story chat so async players see the structure.'}
      </p>
      <button
        type="button"
        onClick={onOpenChapters}
        className="w-full h-11 rounded-xl text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
        style={flamingo ? {
          background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.22), hsl(${FLAMINGO.violet} / 0.15))`,
          color: `hsl(${FLAMINGO.paper})`,
          border: `1px solid hsl(${FLAMINGO.pink} / 0.55)`,
          boxShadow: `0 0 12px -4px hsl(${FLAMINGO.pink} / 0.5)`,
        } : {
          background: 'hsl(var(--primary) / 0.18)',
          color: 'hsl(var(--primary))',
          border: '1px solid hsl(var(--primary) / 0.4)',
        }}
      >
        <Bookmark className="w-3.5 h-3.5" /> {flamingo ? 'Open episode manager' : 'Open chapter manager'}
      </button>
    </div>
  );
}

function MemoryTab({ campaign, onSummarize }: Props & { onSummarize?: () => void }) {
  const flamingo = isFlamingoCampaign(campaign.template_key);
  const configured = isAiConfigured();
  return (
    <div className="space-y-3">
      <p
        className="text-[12px] leading-relaxed"
        style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.85)` : 'hsl(var(--foreground) / 0.85)' }}
      >
        {flamingo
          ? 'The case file is filed by hand — never auto-saved. Draft a summary, review the proposed memory changes, then approve.'
          : 'Campaign memory is updated manually — never auto-saved. Draft a summary, review the proposed memory changes, then approve.'}
      </p>
      <button
        type="button"
        onClick={onSummarize}
        disabled={!configured}
        className="w-full h-11 rounded-xl text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-55"
        style={flamingo ? {
          background: `linear-gradient(135deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.violet}))`,
          color: `hsl(${FLAMINGO.paper})`,
          boxShadow: `0 0 14px -3px hsl(${FLAMINGO.pink} / 0.6)`,
          border: `1px solid hsl(${FLAMINGO.pink} / 0.7)`,
        } : {
          background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
          color: 'hsl(var(--primary-foreground))',
        }}
      >
        <Sparkles className="w-3.5 h-3.5" /> {flamingo ? 'File this scene to memory' : 'Summarize scene → memory'}
      </button>
      {!configured && (
        <p className="text-[10.5px] text-muted-foreground/70">
          AI provider not configured. Wire LOVABLE_API_KEY on the narrative-ai edge function + VITE_NARRATIVE_AI_ENABLED on the client to enable.
        </p>
      )}
      {campaign.memory_summary ? (
        <div
          className="rounded-xl p-3 relative overflow-hidden"
          style={flamingo ? {
            background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
            border: `1px solid hsl(${FLAMINGO.cyan} / 0.4)`,
            boxShadow: `0 0 12px -6px hsl(${FLAMINGO.cyan} / 0.4)`,
            color: `hsl(${FLAMINGO.paper})`,
          } : {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border) / 0.4)',
          }}
        >
          {flamingo && (
            <div aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `hsl(${FLAMINGO.cyan})` }} />
          )}
          <div className={flamingo ? 'pl-2' : ''}>
            <p
              className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--muted-foreground) / 0.7)' }}
            >
              {flamingo ? 'Case file · current' : 'Current summary'}
            </p>
            <p
              className="text-[12px] leading-snug mt-1 whitespace-pre-wrap"
              style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.92)` : 'hsl(var(--foreground) / 0.85)' }}
            >
              {campaign.memory_summary}
            </p>
          </div>
        </div>
      ) : (
        <EmptyHint message={flamingo
          ? 'No case file yet. File a scene to start building the record.'
          : 'No memory has been saved yet. Summarize a scene to begin building the campaign record.'} />
      )}
    </div>
  );
}

function NotesTab({}: Props) {
  return <EmptyHint message="GM-only notes coming next pass. For now, use private GM messages in Story Chat." />;
}

/* The previous AiTab + review-queue UI was retired in favor of the
 * Writer's Room panel mounted directly at the `ai` tab. Suggested
 * state updates are now approved inline within the new DraftCard, so
 * the narrative_ai_suggestions queue is no longer surfaced here. Any
 * historical rows in that table remain readable via DB queries; future
 * passes may add a dedicated "History" view if needed. */

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-muted/25 border border-dashed border-border/40 p-3 text-center">
      <p className="text-[11.5px] text-muted-foreground/75">{message}</p>
    </div>
  );
}
