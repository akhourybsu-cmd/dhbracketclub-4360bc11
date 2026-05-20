// DH Club — Narrative RPG · Story Chat surface
//
// Default tab inside a campaign. Renders the pinned current-scene card,
// the message stream (via SceneMessage), and a mobile-friendly composer
// with three send modes (Speak as character / Action / OOC), a Roll
// button that opens DiceRollSheet, and GM extras (Post as GM,
// Post as NPC, Private GM note).

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Dices, Megaphone, MessageCircle, Sparkles, Lock, ChevronDown, ChevronUp, EyeOff, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { SceneMessage } from './SceneMessage';
import { DiceRollSheet } from './DiceRollSheet';
import { ClockCard } from './ClockCard';
import { PlayerAiAssistMenu } from './PlayerAiAssistMenu';
import { ChapterTransitionOverlay } from './ChapterTransitionOverlay';
import { ComposerModeTrigger, ComposerModeSheet, type ComposerModeOption } from './ComposerModeSheet';
import { isAiConfigured } from '@/lib/narrative/aiService';
import { FlamingoSceneCard } from './flamingo/FlamingoSceneCard';
import { isFlamingoCampaign, FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { STAGGER_CHILD, TAP_PRESS, haptic, EASE_OUT_QUART } from '@/lib/narrative/motion';
import type { Campaign, Character, CampaignMember, Message, MessageType, Scene, Clock } from '@/lib/narrative/types';

interface Props {
  campaign: Campaign;
  isGm: boolean;
  myRole: 'game_master' | 'player' | 'spectator' | null;
  myCharacter: Character | null;
  characters: Character[];
  members: CampaignMember[];
  scenes: Scene[];
  currentScene: Scene | null;
  messages: Message[];
  clocks: Clock[];
  onPost: (input: { body: string; message_type: MessageType; character_id?: string | null; visibility?: 'public' | 'gm_only' | 'private' }) => Promise<void>;
  onRoll: (input: { stat: string; statValue: number; modifier: number; difficulty: number; advantage: 'none' | 'advantage' | 'disadvantage'; reason: string; visibility: 'public' | 'gm_only' }) => Promise<void>;
}

type PostMode = 'character' | 'action' | 'ooc' | 'gm_narration' | 'gm_private';

const MODE_META: Record<PostMode, { label: string; type: MessageType; icon: typeof MessageCircle }> = {
  character:     { label: 'In character',  type: 'player',            icon: MessageCircle },
  action:        { label: 'Action',        type: 'character_action',  icon: Sparkles },
  ooc:           { label: 'OOC',           type: 'ooc',               icon: MessageCircle },
  gm_narration:  { label: 'GM narration',  type: 'gm_narration',      icon: Megaphone },
  gm_private:    { label: 'GM private',    type: 'gm_private',        icon: EyeOff },
};

export function StoryChat({
  campaign, isGm, myRole, myCharacter, characters, members, scenes, currentScene, messages, clocks, onPost, onRoll,
}: Props) {
  const { user } = useAuth();
  const flamingo = isFlamingoCampaign(campaign.template_key);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<PostMode>('character');
  const [rollOpen, setRollOpen] = useState(false);
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const aiEnabled = isAiConfigured();
  const [autoScroll, setAutoScroll] = useState(true);
  // Pinned scene strip can be collapsed on mobile so the chat owns more
  // of the viewport. Default open; user toggle persists in this session.
  const [sceneStripOpen, setSceneStripOpen] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-default mode for spectators and non-character-having players
  useEffect(() => {
    if (myRole === 'spectator') setMode('ooc');
    else if (!myCharacter && !isGm) setMode('ooc');
    else if (isGm) setMode('gm_narration');
  }, [myRole, myCharacter, isGm]);

  // Maps for SceneMessage
  const characterMap = useMemo(() => {
    const m = new Map<string, Character>();
    for (const c of characters) m.set(c.id, c);
    return m;
  }, [characters]);

  // We don't have profile fetches here — synthesize names from member rows
  // by user_id (display_name comes from the campaign data joined in v2).
  // Players see their character names; GM-spoken messages show as the GM.
  const senderNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) {
      m.set(mem.user_id, mem.role === 'game_master' ? 'Game Master' : 'Player');
    }
    return m;
  }, [members]);

  // Auto-scroll on new messages when near bottom
  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, autoScroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(nearBottom);
  };

  const submit = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    haptic('light');
    let posted = false;
    try {
      const meta = MODE_META[mode];
      await onPost({
        body: draft.trim(),
        message_type: meta.type,
        character_id: mode === 'character' || mode === 'action' ? myCharacter?.id ?? null : null,
        visibility: mode === 'gm_private' ? 'gm_only' : 'public',
      });
      posted = true;
    } catch (e) {
      // Don't clear the draft on failure — the user's message stays
      // in the composer so they can retry without retyping.
      toast.error(`Couldn't post: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      // ALWAYS clear sending so the send button doesn't stick.
      setSending(false);
    }
    if (posted) {
      setDraft('');
      setAutoScroll(true);
    }
  };

  const visibleClocks = clocks.filter(c => c.visibility === 'public' || isGm);

  const canCharacterMode = !!myCharacter;
  const allowedModes: PostMode[] = (() => {
    if (myRole === 'spectator') return ['ooc'];
    if (isGm) return ['gm_narration', 'character', 'action', 'ooc', 'gm_private'];
    return canCharacterMode ? ['character', 'action', 'ooc'] : ['ooc'];
  })();

  // Mode options shaped for ComposerModeSheet — adds the per-mode blurb
  // and resolves the icon to a JSX node ahead of time. The blurb only
  // shows in the bottom sheet (desktop chip row stays compact).
  const MODE_BLURB: Record<PostMode, string> = {
    character:    'Speak as your character in the scene.',
    action:       'Describe what your character does.',
    ooc:          'Out-of-character chatter, not part of the story.',
    gm_narration: 'Set the scene, push the story, narrate as GM.',
    gm_private:   'A private GM note — players never see this.',
  };
  const composerModeOptions: ComposerModeOption<PostMode>[] = allowedModes.map(m => {
    const meta = MODE_META[m];
    const Icon = meta.icon;
    return {
      id: m,
      label: meta.label,
      blurb: MODE_BLURB[m],
      icon: <Icon className="w-3.5 h-3.5" />,
      disabled: m === 'character' && !canCharacterMode,
    };
  });
  const activeModeOption =
    composerModeOptions.find(o => o.id === mode) ?? composerModeOptions[0];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Pinned scene + clocks header — collapsible on mobile so the chat
          stream owns more of the viewport. The eyebrow doubles as the
          toggle. */}
      {(currentScene || visibleClocks.length > 0) && (
        <div
          className="px-4 pt-2 pb-2 border-b backdrop-blur-md sticky top-0 z-10"
          style={
            flamingo
              ? {
                  background: `hsl(${FLAMINGO.midnight} / 0.78)`,
                  borderColor: `hsl(${FLAMINGO.pink} / 0.22)`,
                }
              : {
                  background: 'hsl(var(--background) / 0.95)',
                  borderColor: 'hsl(var(--border) / 0.15)',
                }
          }
        >
          <button
            type="button"
            onClick={() => setSceneStripOpen(v => !v)}
            aria-expanded={sceneStripOpen}
            className="w-full flex items-center justify-between gap-2 mb-1 active:opacity-70 transition"
          >
            <span
              className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] inline-flex items-center gap-1.5"
              style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--gold))' }}
            >
              <Megaphone className="w-3 h-3" />
              {currentScene ? currentScene.title : 'Scene context'}
            </span>
            {sceneStripOpen ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
          </button>
          {sceneStripOpen && (
          <div className="space-y-2">
          {currentScene && (
            flamingo ? (
              <FlamingoSceneCard scene={currentScene} />
            ) : (
              <div
                className="rounded-xl border p-2.5"
                style={{ borderColor: 'hsl(var(--gold) / 0.35)', background: 'hsl(var(--gold) / 0.06)' }}
              >
                <div className="flex items-center gap-1.5">
                  <Megaphone className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
                  <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(var(--gold))' }}>
                    Current Scene
                  </p>
                </div>
                <h3 className="text-[13px] font-extrabold tracking-tight mt-0.5">{currentScene.title}</h3>
                {currentScene.objective && (
                  <p className="text-[11px] text-foreground/80 mt-0.5">
                    <span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Objective</span>{currentScene.objective}
                  </p>
                )}
              </div>
            )
          )}
          {visibleClocks.length > 0 && (
            // Mobile (≤640px): 2-column grid so two clocks fit per row
            // and names wrap naturally. Desktop reverts to the
            // horizontal scroller because the wider viewport benefits
            // from a single scannable row. Previously a fixed w-[180px]
            // truncated long clock names like "Tony loses pat…" — now
            // each card takes its full grid cell with line-clamp-2.
            <div
              className="grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto"
              style={{ scrollbarWidth: 'none' }}
            >
              {visibleClocks.slice(0, 6).map(c => (
                <div key={c.id} className="min-w-0 sm:flex-shrink-0 sm:w-[200px]">
                  <ClockCard clock={c} compact showVisibility={isGm && c.visibility === 'gm_only'} />
                </div>
              ))}
            </div>
          )}
          </div>
          )}
        </div>
      )}

      {/* Message stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0"
        style={{ overscrollBehavior: 'contain' }}
      >
        {!currentScene && messages.length === 0 && (
          <EmptyStoryState flamingo={flamingo} isGm={isGm} />
        )}
        {messages.map((m, i) => {
          // Only animate the entrance for the trailing window so older
          // messages don't re-animate on scroll-up. Index check is a
          // cheap proxy; first paint shows everything instantly.
          const fresh = i >= messages.length - 6;
          return (
            <motion.div
              key={m.id}
              initial={fresh ? (STAGGER_CHILD.initial as any) : false}
              animate={STAGGER_CHILD.animate as any}
            >
              <SceneMessage
                message={m}
                characters={characterMap}
                senderNames={senderNames}
                isOwn={m.sender_id === user?.id}
                isGm={isGm}
                flamingo={flamingo}
              />
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Jump-to-latest */}
      <AnimatePresence>
        {!autoScroll && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            onClick={() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); setAutoScroll(true); }}
            // Anchor to the composer's top via a CSS calc so the FAB
            // never collides with the safe-area inset or composer
            // toolbar regardless of viewport height. The composer's
            // own bottom-pad is ~108px (chips + textarea + safe area);
            // we sit a hair above that.
            className="absolute right-4 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-20"
            style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
            aria-label="Jump to latest"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Composer — calm by default, Flamingo neon for Flamingo Protocol. */}
      <div
        className="border-t px-3 pt-2"
        style={{
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
          borderColor: flamingo ? `hsl(${FLAMINGO.pink} / 0.22)` : 'hsl(var(--border) / 0.2)',
          background: flamingo ? `hsl(${FLAMINGO.midnight} / 0.7)` : undefined,
        }}
      >
        {/* Mobile mode trigger — single button + bottom sheet. Saves
            ~36px of vertical space vs the chip scroller and is easier
            to tap on a phone. Desktop keeps the inline chip row below. */}
        {activeModeOption && (
          <div className="sm:hidden flex items-center justify-between gap-2 pb-2">
            <ComposerModeTrigger
              flamingo={flamingo}
              active={activeModeOption}
              onClick={() => setModeSheetOpen(true)}
            />
            <p
              className="text-[10px] uppercase tracking-wider truncate"
              style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.45)` : 'hsl(var(--muted-foreground) / 0.6)' }}
            >
              Tap to change mode
            </p>
          </div>
        )}

        {/* Desktop chip row — the active highlight uses framer-motion's
            layoutId so it animates smoothly between selections instead
            of snap-swapping. Hidden on mobile (< sm). */}
        <div className="hidden sm:flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {allowedModes.map(m => {
            const meta = MODE_META[m];
            const Icon = meta.icon;
            const selected = m === mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={m === 'character' && !canCharacterMode}
                className="relative flex-shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition disabled:opacity-40"
                style={flamingo
                  ? {
                      background: `hsl(${FLAMINGO.ink} / 0.7)`,
                      border: `1px solid hsl(${FLAMINGO.paper} / 0.15)`,
                      color: selected ? `hsl(${FLAMINGO.paper})` : `hsl(${FLAMINGO.paper} / 0.7)`,
                    }
                  : {
                      background: 'hsl(var(--muted) / 0.3)',
                      border: '1px solid hsl(var(--border) / 0.4)',
                      color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.85)',
                    }}
              >
                {selected && (
                  <motion.span
                    layoutId="composer-mode-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    style={flamingo
                      ? {
                          background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.28), hsl(${FLAMINGO.violet} / 0.16))`,
                          border: `1px solid hsl(${FLAMINGO.pink} / 0.6)`,
                          boxShadow: `0 0 10px -3px hsl(${FLAMINGO.pink} / 0.55)`,
                        }
                      : {
                          background: 'hsl(var(--primary) / 0.18)',
                          border: '1px solid hsl(var(--primary) / 0.45)',
                        }}
                  />
                )}
                <span className="relative inline-flex items-center gap-1">
                  <Icon className="w-2.5 h-2.5" /> {meta.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Composer row */}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={
              mode === 'gm_narration'   ? 'Set the scene…' :
              mode === 'gm_private'     ? 'Private GM note (only you see this)…' :
              mode === 'action'         ? "What's your character doing?" :
              mode === 'ooc'            ? 'Out-of-character message…' :
              `${myCharacter?.name ?? 'Your character'} says…`
            }
            rows={1}
            className="flex-1 resize-none text-[13px] min-h-[44px]"
            style={flamingo ? {
              background: `hsl(${FLAMINGO.ink} / 0.85)`,
              border: `1px solid hsl(${FLAMINGO.cyan} / 0.35)`,
              color: `hsl(${FLAMINGO.paper})`,
            } : undefined}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
          />
          {/* Player AI assist — only for players (incl. GM playing) when AI is enabled. */}
          {myRole !== 'spectator' && aiEnabled && (
            <button
              type="button"
              onClick={() => setAiAssistOpen(true)}
              aria-label="Help me write"
              title="Help me write"
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition"
              style={flamingo ? {
                background: `hsl(${FLAMINGO.ink})`,
                border: `1px solid hsl(${FLAMINGO.cyan} / 0.4)`,
                color: `hsl(${FLAMINGO.cyan})`,
                boxShadow: `0 0 10px -4px hsl(${FLAMINGO.cyan} / 0.4)`,
              } : {
                background: 'hsl(var(--muted) / 0.3)',
                border: '1px solid hsl(var(--border) / 0.4)',
                color: 'hsl(var(--foreground) / 0.75)',
              }}
            >
              <Wand2 className="w-4 h-4" />
            </button>
          )}
          {myRole !== 'spectator' && (
            <button
              type="button"
              onClick={() => setRollOpen(true)}
              aria-label="Roll dice"
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition"
              style={flamingo ? {
                background: `hsl(${FLAMINGO.ink})`,
                border: `1px solid hsl(${FLAMINGO.gold} / 0.45)`,
                color: `hsl(${FLAMINGO.gold})`,
                boxShadow: `0 0 10px -4px hsl(${FLAMINGO.gold} / 0.4)`,
              } : {
                background: 'hsl(var(--muted) / 0.3)',
                border: '1px solid hsl(var(--border) / 0.4)',
                color: 'hsl(var(--foreground) / 0.75)',
              }}
            >
              <Dices className="w-4 h-4" />
            </button>
          )}
          <motion.button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || sending}
            onMouseDown={e => e.preventDefault()}
            aria-label="Send"
            whileTap={draft.trim() && !sending ? TAP_PRESS : undefined}
            animate={{
              scale: draft.trim() ? 1 : 0.92,
              transition: { duration: 0.16, ease: EASE_OUT_QUART },
            }}
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-50"
            style={flamingo
              ? {
                  background: draft.trim()
                    ? `linear-gradient(135deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.violet}))`
                    : `hsl(${FLAMINGO.smoke} / 0.6)`,
                  color: `hsl(${FLAMINGO.paper})`,
                  boxShadow: draft.trim() ? `0 0 14px -3px hsl(${FLAMINGO.pink} / 0.7)` : 'none',
                  border: draft.trim() ? `1px solid hsl(${FLAMINGO.pink})` : `1px solid hsl(${FLAMINGO.paper} / 0.2)`,
                }
              : {
                  background: draft.trim() ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))' : 'hsl(var(--muted) / 0.5)',
                  color: 'hsl(var(--primary-foreground))',
                }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {sending ? (
                <motion.span
                  key="sending"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1, rotate: 360 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.4, ease: 'linear', repeat: Infinity }}
                  className="inline-flex"
                >
                  <Sparkles className="w-4 h-4" />
                </motion.span>
              ) : mode === 'gm_private' ? (
                <motion.span key="lock" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                  <Lock className="w-4 h-4" />
                </motion.span>
              ) : (
                <motion.span key="send" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 4 }}>
                  <Send className="w-4 h-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      <DiceRollSheet
        open={rollOpen}
        onClose={() => setRollOpen(false)}
        character={myCharacter}
        isGm={isGm}
        onRoll={async input => { await onRoll(input as any); }}
      />
      <PlayerAiAssistMenu
        open={aiAssistOpen}
        onClose={() => setAiAssistOpen(false)}
        campaignId={campaign.id}
        character={myCharacter}
        draft={draft}
        onApply={next => setDraft(next)}
      />
      {/* Cinematic chapter takeover — fires when a fresh
          chapter_transition message arrives in the stream. */}
      <ChapterTransitionOverlay
        latestMessage={messages.length > 0 ? messages[messages.length - 1] : null}
        flamingo={flamingo}
      />
      {/* Mobile composer mode selector. Rendered regardless of viewport
          — the trigger is sm:hidden so the sheet only opens on phones. */}
      <ComposerModeSheet
        open={modeSheetOpen}
        onClose={() => setModeSheetOpen(false)}
        flamingo={flamingo}
        modes={composerModeOptions}
        value={mode}
        onSelect={(next) => setMode(next as PostMode)}
      />
    </div>
  );
}

/** Empty Story Chat state — replaces the lonely "Waiting for the Game
 *  Master" hint with an illustrated, branded card. The illustration is
 *  inline SVG so it ships as part of the JS bundle and themes via the
 *  Flamingo tokens. */
function EmptyStoryState({ flamingo, isGm }: { flamingo: boolean; isGm: boolean }) {
  const pink = flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))';
  const cyan = flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--primary) / 0.6)';
  const ink = flamingo ? `hsl(${FLAMINGO.ink})` : 'hsl(var(--card))';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT_QUART } }}
      className="text-center py-10 px-4 max-w-sm mx-auto"
    >
      <div className="relative w-32 h-32 mx-auto mb-5">
        {/* Faux clapperboard / spotlight illustration — stripped to
            simple geometric primitives so it reads at any density. */}
        <svg viewBox="0 0 128 128" className="absolute inset-0">
          <defs>
            <linearGradient id="esg-1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={pink} />
              <stop offset="1" stopColor={cyan} />
            </linearGradient>
            <radialGradient id="esg-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor={pink} stopOpacity="0.35" />
              <stop offset="1" stopColor={pink} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="64" cy="64" r="60" fill="url(#esg-glow)" />
          {/* clapper top stripes */}
          <rect x="22" y="26" width="84" height="14" rx="2" fill={ink} stroke="url(#esg-1)" strokeWidth="1.2" />
          <g fill={pink}>
            <rect x="26" y="29" width="10" height="8" transform="skewX(-18)" />
            <rect x="46" y="29" width="10" height="8" transform="skewX(-18)" />
            <rect x="66" y="29" width="10" height="8" transform="skewX(-18)" />
            <rect x="86" y="29" width="10" height="8" transform="skewX(-18)" />
          </g>
          {/* clapper body */}
          <rect x="22" y="42" width="84" height="58" rx="3" fill={ink} stroke="url(#esg-1)" strokeWidth="1.4" />
          {/* lines on body */}
          <line x1="32" y1="60" x2="78" y2="60" stroke={cyan} strokeWidth="1.4" strokeOpacity="0.55" strokeLinecap="round" />
          <line x1="32" y1="72" x2="92" y2="72" stroke={cyan} strokeWidth="1.4" strokeOpacity="0.4" strokeLinecap="round" />
          <line x1="32" y1="84" x2="64" y2="84" stroke={cyan} strokeWidth="1.4" strokeOpacity="0.3" strokeLinecap="round" />
          {/* spotlight beam */}
          <path d="M 64 12 L 50 26 L 78 26 Z" fill={pink} fillOpacity="0.18" />
          <circle cx="64" cy="10" r="3" fill={pink} />
        </svg>
      </div>
      <p
        className="font-display text-[17px] font-extrabold tracking-tight"
        style={flamingo ? {
          backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), ${pink})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        } : undefined}
      >
        {isGm
          ? (flamingo ? 'Roll sound. Light the neon.' : 'Set the first scene.')
          : (flamingo ? 'Velvetaine waits in the wings.' : 'Waiting on the Game Master.')}
      </p>
      <p
        className="text-[11.5px] mt-1.5 leading-snug"
        style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.65)` : 'hsl(var(--muted-foreground) / 0.8)' }}
      >
        {isGm
          ? 'Open the GM Console and start a scene to give your crew somewhere to act.'
          : 'The GM is staging the first scene — keep an eye on this thread.'}
      </p>
    </motion.div>
  );
}
