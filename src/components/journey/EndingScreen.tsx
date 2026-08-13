// The ending experience: resolved ending record, qualifying epilogue
// passages, and a spoiler-safe recap of the decisions the player made.

import { Link } from 'react-router-dom';
import { Sparkles, ScrollText, Star } from 'lucide-react';
import { JourneySkeleton } from '@/components/journey/JourneyLayout';
import type { EndingPayload } from '@/lib/journey/types';

export function EndingScreen({
  payload, loading, campaignTitle,
}: { payload: EndingPayload | null; loading: boolean; campaignTitle?: string | null }) {
  if (loading) {
    return <div className="jy-panel-raised mt-8 p-5"><JourneySkeleton lines={5} /></div>;
  }

  const ending = payload?.ending ?? null;
  const epilogue = payload?.epilogue_blocks ?? [];
  const recap = payload?.recap ?? [];
  const major = recap.filter((r) => r.major_decision);
  const shown = major.length > 0 ? major : recap.slice(-6);

  return (
    <section className="mt-8" aria-label="Ending">
      <div className="jy-panel-raised overflow-hidden">
        {ending?.artwork && (
          <img
            src={ending.artwork}
            alt={ending.name ? `Artwork for the ending “${ending.name}”` : 'Ending artwork'}
            className="h-44 w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="p-5 text-center">
          <Sparkles className="mx-auto mb-2 h-5 w-5" style={{ color: 'hsl(var(--jy-gold))' }} aria-hidden />
          <div className="jy-eyebrow">{campaignTitle ?? payload?.campaign?.title ?? 'Your journey'}</div>
          <h2 className="jy-display mt-1 text-2xl">{ending?.name ?? 'Here the tale rests'}</h2>
          {ending?.description && <p className="jy-prose mt-2 text-sm">{ending.description}</p>}
          {!ending && (
            <p className="jy-secondary mt-2 text-sm">This chapter of your journey is complete.</p>
          )}
          {ending?.spoiler_safe_label && (
            <span className="jy-chip jy-chip-gold mt-3 inline-flex">{ending.spoiler_safe_label}</span>
          )}
        </div>
      </div>

      {epilogue.length > 0 && (
        <div className="mt-5 space-y-3">
          {epilogue.map((b, i) => (
            <div key={i} className="jy-panel p-4">
              <p className="jy-prose whitespace-pre-line text-[0.95rem] leading-relaxed">{b.content}</p>
            </div>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <div className="mt-6">
          <h3 className="jy-eyebrow flex items-center gap-1.5">
            <ScrollText className="h-3 w-3" aria-hidden /> What you chose
          </h3>
          <ul className="mt-2 space-y-2">
            {shown.map((r, i) => (
              <li key={`${r.at}-${i}`} className="jy-panel p-3">
                <div className="flex items-start gap-2">
                  {r.major_decision && (
                    <Star className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--jy-gold))' }} aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="jy-secondary text-sm">{r.choice_text ?? 'A decision was made.'}</p>
                    {(r.scene_title || r.chapter_title) && (
                      <p className="jy-muted mt-1 text-xs">
                        {[r.chapter_title, r.scene_title].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link className="jy-btn jy-btn-primary" to="/journey">Return to the campaign hall</Link>
        <Link className="jy-btn jy-btn-ghost" to="/journey/journal">Read the full record</Link>
      </div>
    </section>
  );
}
