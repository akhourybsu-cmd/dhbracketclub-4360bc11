import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import type { Prologue } from '@/lib/journey/prologues';

/**
 * Optional, replayable story introduction.
 *
 * Pure presentation: it never creates or mutates a run, never marks scenes
 * complete and never touches campaign state. `onLaunch` simply hands control
 * back to the campaign's normal start/resume flow.
 */
export function StoryIntroduction({
  prologue, onClose, onLaunch,
}: {
  prologue: Prologue;
  onClose: () => void;
  onLaunch: () => void;
}) {
  const [index, setIndex] = useState(-1); // -1 = title card
  const last = prologue.panels.length - 1;
  const panel = index >= 0 ? prologue.panels[index] : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      style={{ background: 'hsl(28 14% 4% / 0.92)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`${prologue.title} — story introduction`}
    >
      <div className="jy-panel-raised flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden sm:rounded-sm">
        <div className="flex items-center justify-between gap-2 px-5 pt-4">
          <span className="jy-eyebrow">Story introduction</span>
          <button className="jy-btn jy-btn-sm jy-btn-ghost" onClick={onClose} aria-label="Close introduction">
            <X className="h-4 w-4" aria-hidden /> Skip
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 pb-5 pt-3">
          {panel === null ? (
            <div className="py-10 text-center">
              <h2 className="jy-display text-2xl">{prologue.title}</h2>
              <p className="jy-secondary mt-2 text-sm italic">{prologue.eyebrow}</p>
              <div className="jy-rule mx-auto mt-6 w-24" />
            </div>
          ) : (
            <div>
              <div
                className="flex min-h-[104px] items-center justify-center rounded-sm px-4 py-5 text-center"
                style={{ background: 'hsl(var(--jy-ink) / 0.35)', border: '1px solid hsl(var(--jy-brass) / 0.18)' }}
              >
                <p className="jy-muted text-xs italic">{panel.visual_brief}</p>
              </div>
              <div className="mt-4 space-y-3">
                {panel.paragraphs.map((p, i) => (
                  <p key={i} className="jy-prose text-sm">{p}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-5 py-3"
          style={{ borderColor: 'hsl(var(--jy-brass) / 0.18)' }}>
          <button
            className="jy-btn jy-btn-sm jy-btn-ghost"
            onClick={() => setIndex((i) => Math.max(-1, i - 1))}
            disabled={index === -1}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back
          </button>
          <span className="jy-muted text-xs">
            {index === -1 ? 'Title card' : `${index + 1} / ${prologue.panels.length}`}
          </span>
          {index < last ? (
            <button className="jy-btn jy-btn-sm jy-btn-primary" onClick={() => setIndex((i) => i + 1)}>
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button className="jy-btn jy-btn-sm jy-btn-primary" onClick={onLaunch}>
              <Play className="h-4 w-4" aria-hidden /> {prologue.launchLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
