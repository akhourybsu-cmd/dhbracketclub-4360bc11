// DH Club — Narrative RPG · Single message renderer
//
// Story Chat supports many message types — this dispatches to a styled
// variant per type. Player + character_action align right (own) or left
// (others), GM narration spans width with elevated styling, dice rolls
// use the DiceRollCard, system updates render as compact inline notes.

import { format } from 'date-fns';
import { Sparkles, Megaphone, KeyRound, Backpack, Users as UsersIcon, Clock as ClockIcon, AlertOctagon, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message, MessageType, Character } from '@/lib/narrative/types';
import { DiceRollCard } from './DiceRollCard';
import { FlamingoSceneMessage } from './flamingo/FlamingoMessageFrames';

interface Props {
  message: Message;
  /** Map character_id → character (for label + initials). */
  characters: Map<string, Character>;
  /** Map sender user_id → display name. Optional — falls back to "Someone". */
  senderNames?: Map<string, string>;
  /** Map npc_id → npc name. */
  npcNames?: Map<string, string>;
  /** True if this message was sent by the current user (right-align). */
  isOwn: boolean;
  /** True if the current viewer is the GM (additional styling for private messages). */
  isGm: boolean;
  /** When the active campaign is Flamingo Protocol, dispatch to the
   *  neon message frames instead of the calm-shell defaults. */
  flamingo?: boolean;
}

export function SceneMessage({ message, characters, senderNames, npcNames, isOwn, isGm, flamingo }: Props) {
  if (flamingo) {
    return (
      <FlamingoSceneMessage
        message={message}
        characters={characters}
        senderNames={senderNames}
        npcNames={npcNames}
        isOwn={isOwn}
        isGm={isGm}
      />
    );
  }
  const t = message.message_type;

  // Dice roll — dedicated card
  if (t === 'dice_roll') {
    const rollerName = message.character_id ? characters.get(message.character_id)?.name : (message.sender_id ? senderNames?.get(message.sender_id) : undefined);
    return <DiceRollCard message={message} rollerName={rollerName} isGm={isGm} campaignId={message.campaign_id} />;
  }

  // Scene card — banner
  if (t === 'scene_card') {
    const meta = message.metadata as any;
    return (
      <div
        className="rounded-2xl p-3.5 border"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.18), hsl(var(--gold) / 0.04))',
          borderColor: 'hsl(var(--gold) / 0.4)',
        }}
      >
        <p className="text-[9px] font-extrabold uppercase tracking-[0.24em]" style={{ color: 'hsl(var(--gold))' }}>
          ◆ New Scene
        </p>
        <h3 className="text-[15px] font-extrabold tracking-tight mt-0.5">{message.body}</h3>
        {(meta?.location || meta?.objective) && (
          <div className="mt-2 space-y-1 text-[11px]">
            {meta?.location && <p className="text-foreground/80"><span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Location</span>{meta.location}</p>}
            {meta?.objective && <p className="text-foreground/80"><span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Objective</span>{meta.objective}</p>}
            {meta?.stakes && <p className="text-foreground/80"><span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Stakes</span>{meta.stakes}</p>}
          </div>
        )}
      </div>
    );
  }

  // Chapter transition — dedicated full-width title card (parity with Flamingo)
  if (t === 'chapter_transition') {
    const meta = message.metadata as any;
    const chapterNumber = meta?.chapter_number ?? meta?.number;
    return (
      <div
        className="rounded-2xl border p-4 my-1"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.14), hsl(var(--gold) / 0.03) 60%, hsl(var(--card)))',
          borderColor: 'hsl(var(--gold) / 0.45)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <Bookmark className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.28em]" style={{ color: 'hsl(var(--gold))' }}>
            {chapterNumber != null ? `Chapter ${chapterNumber}` : 'New Chapter'}
          </p>
        </div>
        <h3 className="text-[16px] font-extrabold tracking-tight mt-1 leading-tight">{message.body}</h3>
        {meta?.subtitle && (
          <p className="text-[12px] italic text-foreground/70 leading-snug mt-1">{meta.subtitle}</p>
        )}
      </div>
    );
  }

  // Campaign summary — slightly elevated card (more prominent than system strip)
  if (t === 'campaign_summary') {
    return (
      <div
        className="rounded-2xl border px-3.5 py-3"
        style={{
          borderColor: 'hsl(var(--primary) / 0.4)',
          background: 'linear-gradient(180deg, hsl(var(--primary) / 0.06), hsl(var(--card)))',
        }}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary" />
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-primary">Campaign Summary</p>
        </div>
        <p className="text-[12.5px] text-foreground/85 leading-relaxed mt-1 whitespace-pre-wrap">{message.body}</p>
      </div>
    );
  }

  // System/structured updates (clue, inventory, faction, clock, etc.)
  if (t === 'clue_discovered' || t === 'inventory_update' || t === 'faction_update' || t === 'clock_update' || t === 'system') {
    const sysMeta: Record<string, { label: string; icon: typeof Sparkles; accent: string }> = {
      clue_discovered:    { label: 'Clue discovered',   icon: KeyRound,    accent: '195 80% 55%' },
      inventory_update:   { label: 'Inventory update',  icon: Backpack,    accent: '38 95% 55%' },
      faction_update:     { label: 'Faction update',    icon: UsersIcon,   accent: '270 70% 60%' },
      clock_update:       { label: 'Clock advanced',    icon: ClockIcon,   accent: '0 75% 55%' },
      system:             { label: 'System',            icon: AlertOctagon, accent: 'var(--muted-foreground)' },
    };
    const meta = sysMeta[t];
    const Icon = meta.icon;
    return (
      <div
        className="rounded-xl bg-card border px-3 py-2.5 flex items-start gap-2"
        style={{ borderColor: `hsl(${meta.accent} / 0.35)` }}
      >
        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: `hsl(${meta.accent})` }} />
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${meta.accent})` }}>{meta.label}</p>
          <p className="text-[12.5px] text-foreground/85 leading-snug mt-0.5">{message.body}</p>
        </div>
      </div>
    );
  }

  // GM narration — full width, no bubble, italic intro
  if (t === 'gm_narration') {
    return (
      <div
        className="rounded-2xl border p-3.5"
        style={{
          borderColor: 'hsl(var(--gold) / 0.32)',
          background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
          borderLeftWidth: '3px',
          borderLeftStyle: 'solid',
          borderLeftColor: 'hsl(var(--gold))',
        }}
      >
        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(var(--gold))' }}>
          <Megaphone className="w-2.5 h-2.5 inline-block mr-1" /> GM Narration
        </p>
        <p className="text-[13.5px] text-foreground/90 leading-relaxed mt-1 whitespace-pre-wrap">{message.body}</p>
      </div>
    );
  }

  // NPC dialogue
  if (t === 'npc_dialogue') {
    const npcName = (message.metadata as any)?.npc_name || (message.npc_id && npcNames?.get(message.npc_id)) || 'NPC';
    const npcInitial = npcName.charAt(0).toUpperCase();
    return (
      <div className="flex items-start gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 border"
          style={{
            background: 'hsl(var(--muted) / 0.5)',
            borderColor: 'hsl(var(--border) / 0.45)',
            color: 'hsl(var(--foreground) / 0.75)',
          }}
        >
          {npcInitial}
        </div>
        <div className="min-w-0 flex-1 rounded-2xl border border-border/35 bg-card p-3 rounded-tl-md">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/80">
            {npcName}
            <span className="ml-1.5 text-[8.5px] font-bold tracking-wider text-muted-foreground/55">NPC</span>
          </p>
          <p className="text-[13.5px] italic text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">&ldquo;{message.body}&rdquo;</p>
        </div>
      </div>
    );
  }

  // GM private note (only visible to GM)
  if (t === 'gm_private') {
    if (!isGm) return null;
    return (
      <div className="rounded-xl bg-muted/30 border border-dashed border-border/50 p-2.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">GM note · private</p>
        <p className="text-[12px] text-foreground/85 leading-snug mt-0.5 whitespace-pre-wrap">{message.body}</p>
      </div>
    );
  }

  // AI suggestion (only visible to GM)
  if (t === 'ai_suggestion') {
    if (!isGm) return null;
    return (
      <div
        className="rounded-xl border p-2.5"
        style={{ borderColor: 'hsl(var(--primary) / 0.45)', background: 'hsl(var(--primary) / 0.08)' }}
      >
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-primary">AI suggestion · awaiting GM</p>
        <p className="text-[12px] text-foreground/85 leading-snug mt-0.5 whitespace-pre-wrap">{message.body}</p>
      </div>
    );
  }

  // Default: player message / character_action / ooc — chat bubble
  const character = message.character_id ? characters.get(message.character_id) : undefined;
  const senderName = character?.name
    ?? (message.sender_id ? senderNames?.get(message.sender_id) : undefined)
    ?? 'Someone';
  const initial = senderName.charAt(0).toUpperCase();
  const isOoc = t === 'ooc';
  const isAction = t === 'character_action';

  return (
    <div className={cn('flex items-end gap-2', isOwn ? 'justify-end' : 'justify-start')}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
          {initial}
        </div>
      )}
      <div className="max-w-[80%] min-w-[60px]">
        {!isOwn && (
          <p className="text-[11px] font-bold text-foreground/80 mb-0.5 pl-1">
            {senderName}
            {isOoc && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">OOC</span>}
          </p>
        )}
        <div
          className={cn(
            'rounded-2xl px-3 py-2',
            isOwn ? 'rounded-br-md' : 'rounded-bl-md',
            isAction && 'italic',
          )}
          style={{
            background: isOwn
              ? 'hsl(var(--chat-own-bg, var(--primary) / 0.18))'
              : 'hsl(var(--chat-incoming, var(--muted) / 0.45))',
          }}
        >
          {isAction && (
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground/70 mb-1">Action</p>
          )}
          <p className="text-[13px] leading-snug text-foreground/90 whitespace-pre-wrap break-words">
            {message.body}
          </p>
          <p className="text-[9px] text-muted-foreground/50 text-right mt-1 tabular-nums">
            {format(new Date(message.created_at), 'h:mm a')}
          </p>
        </div>
      </div>
    </div>
  );
}
