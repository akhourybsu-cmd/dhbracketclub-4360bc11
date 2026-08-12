import { Fragment } from 'react';
import { BookOpen, MapPin, Package, ScrollText, Sparkles, Swords } from 'lucide-react';
import type { RuntimeBlock } from '@/lib/journey/types';

/**
 * Renders the ordered narrative blocks of a scene. Conditional blocks are
 * already filtered server-side, so nothing hidden ever reaches the client.
 * Artwork is always optional: a missing image falls back to atmosphere rather
 * than a broken placeholder.
 */
export function SceneBlocks({ blocks }: { blocks: RuntimeBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => (
        <Fragment key={`${b.block_type}-${b.display_order}-${i}`}>{renderBlock(b)}</Fragment>
      ))}
    </div>
  );
}

function renderBlock(b: RuntimeBlock) {
  const md = (b.metadata ?? {}) as Record<string, any>;
  switch (b.block_type) {
    case 'location_intro':
      return (
        <div className="jy-fade-in py-2">
          <div className="jy-eyebrow flex items-center gap-1.5">
            <MapPin className="h-3 w-3" aria-hidden />
            {md.region ?? 'Mesoplasia'}
          </div>
          <h2 className="jy-title mt-1">{b.content}</h2>
          <div className="jy-rule mt-3" />
        </div>
      );

    case 'character_intro':
      return (
        <div className="jy-panel jy-fade-in p-4">
          <div className="jy-eyebrow">{md.title ?? 'Encounter'}</div>
          <h3 className="jy-display mt-1 text-lg">{md.name ?? b.content}</h3>
          {md.description && <p className="jy-prose mt-2 text-sm">{md.description}</p>}
        </div>
      );

    case 'dialogue':
      return (
        <div className="jy-dialogue jy-fade-in">
          <div className="jy-speaker">{md.speaker_name ?? md.speaker_key ?? 'Unknown'}</div>
          {md.emotion && md.emotion !== 'neutral' && (
            <div className="jy-muted mb-1 text-[0.7rem] italic">{md.emotion}</div>
          )}
          <p className="jy-prose italic">{b.content}</p>
        </div>
      );

    case 'image':
      return md.src ? (
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
      ) : null;

    case 'discovery':
      return <SystemLine icon={Sparkles} tone="gold" text={b.content ?? ''} />;
    case 'quest_update':
      return <SystemLine icon={ScrollText} tone="gold" text={b.content ?? ''} />;
    case 'item_received':
      return <SystemLine icon={Package} tone="gold" text={b.content ?? ''} />;
    case 'codex_unlock':
      return <SystemLine icon={BookOpen} tone="forest" text={b.content ?? ''} />;
    case 'relationship_update':
    case 'system_message':
      return <SystemLine icon={Sparkles} tone="muted" text={b.content ?? ''} />;

    case 'stat_check':
      return (
        <div className="jy-chip jy-chip-gold">{md.stat ?? 'Check'} {md.value ?? ''}</div>
      );

    case 'combat':
      return (
        <div className="jy-panel jy-fade-in flex items-start gap-3 p-4">
          <Swords className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'hsl(var(--jy-blood))' }} aria-hidden />
          <p className="jy-prose text-sm">{b.content}</p>
        </div>
      );

    case 'divider':
      return <div className="jy-rule my-6" role="separator" />;

    case 'transition':
      return <p className="jy-muted jy-fade-in text-center text-sm italic">{b.content}</p>;

    case 'narration':
    default:
      return (
        <div className="jy-prose jy-fade-in">
          {(b.content ?? '').split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      );
  }
}

function SystemLine({
  icon: Icon, text, tone,
}: { icon: typeof Sparkles; text: string; tone: 'gold' | 'forest' | 'muted' }) {
  const color = tone === 'gold' ? 'hsl(var(--jy-gold))'
    : tone === 'forest' ? 'hsl(150 28% 62%)' : 'hsl(var(--jy-text-muted))';
  return (
    <div className="jy-fade-in flex items-center gap-2 text-sm" style={{ color }}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
