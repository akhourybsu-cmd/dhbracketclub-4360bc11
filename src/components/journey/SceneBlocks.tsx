import { Fragment, useEffect, useRef, useState } from 'react';
import { BookOpen, MapPin, Package, ScrollText, Sparkles, Swords } from 'lucide-react';
import type { RuntimeBlock } from '@/lib/journey/types';
import { DialogueBlock } from './DialogueBlock';
import { Instant, Typewriter } from './Typewriter';

/**
 * Renders the ordered narrative blocks of a scene, one beat at a time: text is
 * narrated character by character, and the next block only appears once the
 * previous one has finished. Tapping anywhere reveals the rest immediately.
 * `onDone` fires when the whole scene has been told, so choices can follow.
 */
export function SceneBlocks({
  blocks, onDone,
}: { blocks: RuntimeBlock[]; onDone?: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const [skip, setSkip] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => { setRevealed(0); setSkip(false); }, [blocks]);

  const complete = revealed >= blocks.length;
  useEffect(() => { if (complete) doneRef.current?.(); }, [complete]);

  return (
    <div
      className="space-y-5"
      onClick={() => { if (!complete) setSkip(true); }}
    >
      {blocks.slice(0, revealed + 1).map((b, i) => (
        <Fragment key={`${b.block_type}-${b.display_order}-${i}`}>
          {renderBlock(b, {
            active: i === revealed,
            skip: skip || i < revealed,
            onDone: () => setRevealed((n) => Math.max(n, i + 1)),
          })}
        </Fragment>
      ))}
      {!complete && (
        <div className="jy-muted text-[0.7rem] tracking-wide">tap to continue</div>
      )}
    </div>
  );
}

interface Beat { active: boolean; skip: boolean; onDone: () => void }

function renderBlock(b: RuntimeBlock, beat: Beat) {
  const md = (b.metadata ?? {}) as Record<string, any>;
  switch (b.block_type) {
    case 'location_intro':
      return (
        <Instant skip={beat.skip} onDone={beat.onDone}>
          <div className="jy-fade-in py-2">
            <div className="jy-eyebrow flex items-center gap-1.5">
              <MapPin className="h-3 w-3" aria-hidden />
              {md.region ?? 'Mesoplasia'}
            </div>
            <h2 className="jy-title mt-1">{b.content}</h2>
            <div className="jy-rule mt-3" />
          </div>
        </Instant>
      );

    case 'character_intro':
      return (
        <div className="jy-panel jy-fade-in p-4">
          <div className="jy-eyebrow">{md.title ?? 'Encounter'}</div>
          <h3 className="jy-display mt-1 text-lg">{md.name ?? b.content}</h3>
          {md.description ? (
            <p className="jy-prose mt-2 text-sm">
              <Typewriter text={String(md.description)} active={beat.active} skip={beat.skip} onDone={beat.onDone} />
            </p>
          ) : (
            <Instant skip={beat.skip} onDone={beat.onDone}>{null}</Instant>
          )}
        </div>
      );

    case 'dialogue':
      return (
        <DialogueBlock
          speaker={String(md.speaker_name ?? md.speaker_key ?? 'Unknown')}
          emotion={md.emotion as string | undefined}
          portrait={(md.portrait ?? md.portrait_url) as string | undefined}
          text={b.content ?? ''}
          active={beat.active}
          skip={beat.skip}
          onDone={beat.onDone}
        />
      );

    case 'image':
      return md.src ? (
        <Instant skip={beat.skip} onDone={beat.onDone}>
          <figure className="jy-fade-in">
            <img
              src={md.src}
              alt={md.alt ?? ''}
              loading="lazy"
              decoding="async"
              className="w-full rounded-sm"
              style={{ border: '1px solid hsl(var(--jy-border-subtle))' }}
            />
            {md.caption && <figcaption className="jy-muted mt-1.5 text-xs">{md.caption}</figcaption>}
          </figure>
        </Instant>
      ) : <Instant skip={beat.skip} onDone={beat.onDone}>{null}</Instant>;

    case 'discovery':
      return <SystemLine icon={Sparkles} tone="gold" text={b.content ?? ''} beat={beat} />;
    case 'quest_update':
      return <SystemLine icon={ScrollText} tone="gold" text={b.content ?? ''} beat={beat} />;
    case 'item_received':
      return <SystemLine icon={Package} tone="gold" text={b.content ?? ''} beat={beat} />;
    case 'codex_unlock':
      return <SystemLine icon={BookOpen} tone="forest" text={b.content ?? ''} beat={beat} />;
    case 'relationship_update':
    case 'system_message':
      return <SystemLine icon={Sparkles} tone="muted" text={b.content ?? ''} beat={beat} />;

    case 'stat_check':
      return (
        <Instant skip={beat.skip} onDone={beat.onDone}>
          <div className="jy-chip jy-chip-gold">{md.stat ?? 'Check'} {md.value ?? ''}</div>
        </Instant>
      );

    case 'combat':
      return (
        <div className="jy-panel jy-fade-in flex items-start gap-3 p-4">
          <Swords className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'hsl(var(--jy-blood))' }} aria-hidden />
          <p className="jy-prose text-sm">
            <Typewriter text={b.content ?? ''} active={beat.active} skip={beat.skip} onDone={beat.onDone} />
          </p>
        </div>
      );

    case 'divider':
      return (
        <Instant skip={beat.skip} onDone={beat.onDone}>
          <div className="jy-rule my-6" role="separator" />
        </Instant>
      );

    case 'transition':
      return (
        <p className="jy-muted jy-fade-in text-center text-sm italic">
          <Typewriter text={b.content ?? ''} active={beat.active} skip={beat.skip} onDone={beat.onDone} />
        </p>
      );

    case 'narration':
    default: {
      const paras = (b.content ?? '').split(/\n{2,}/);
      return <Paragraphs paras={paras} beat={beat} />;
    }
  }
}

/** Narration: paragraphs typed in sequence. */
function Paragraphs({ paras, beat }: { paras: string[]; beat: Beat }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [paras.join('\u0000')]);
  const shown = beat.skip ? paras.length - 1 : index;

  return (
    <div className="jy-prose jy-fade-in">
      {paras.slice(0, shown + 1).map((para, i) => (
        <p key={i}>
          <Typewriter
            text={para}
            active={beat.active && i === shown}
            skip={beat.skip || i < shown}
            onDone={() => {
              if (i < paras.length - 1) setIndex((n) => Math.max(n, i + 1));
              else beat.onDone();
            }}
          />
        </p>
      ))}
    </div>
  );
}

function SystemLine({
  icon: Icon, text, tone, beat,
}: { icon: typeof Sparkles; text: string; tone: 'gold' | 'forest' | 'muted'; beat: Beat }) {
  const color = tone === 'gold' ? 'hsl(var(--jy-gold))'
    : tone === 'forest' ? 'hsl(150 28% 62%)' : 'hsl(var(--jy-text-muted))';
  return (
    <div className="jy-fade-in flex items-center gap-2 text-sm" style={{ color }}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <Typewriter text={text} active={beat.active} skip={beat.skip} onDone={beat.onDone} />
      </span>
    </div>
  );
}
