import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderUp, ImagePlus, Trash2, UploadCloud, X } from 'lucide-react';
import { exportCampaignPackage } from '@/hooks/useJourneyStudio';
import {
  isImageUrl, setJourneyAsset, uploadJourneyImage, visualBrief, type AssetTarget,
} from '@/lib/journey/art';
import type { CampaignPackage } from '@/lib/journey/types';

interface Slot {
  id: string;            // unique per slot
  target: AssetTarget;
  key: string;           // scene_key / ending_key / '' for campaign
  label: string;
  guidance?: string | null;
  url?: string | null;
}

/**
 * Studio image manager. Lists every place "The Splendid Journey" expects art —
 * each scene backdrop (with its authored visual brief), each ending, and the
 * campaign cover/hero — and lets an author upload into the exact slot. Uploads
 * land in the draft; a note reminds the author to Publish to make them live.
 * Portaled to <body> and re-scoped in `jy-mode` so the sheet escapes any
 * transformed ancestor.
 */
export function JourneyIllustrateSheet({
  campaignId, title, onClose,
}: { campaignId: string; title: string; onClose: () => void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkReport, setBulkReport] = useState<{ uploaded: string[]; skipped: string[] } | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const pkg: CampaignPackage = await exportCampaignPackage(campaignId);
      const next: Slot[] = [];
      next.push({ id: 'cover', target: 'cover_image', key: '', label: 'Cover image', guidance: 'The campaign’s card art in the hall.', url: (pkg.campaign as any)?.cover_image });
      next.push({ id: 'hero', target: 'hero_image', key: '', label: 'Hero image', guidance: 'A wide banner used on the campaign’s feature surfaces.', url: (pkg.campaign as any)?.hero_image });
      (pkg.scenes ?? []).forEach((s: any) => {
        next.push({
          id: `scene:${s.scene_key}`, target: 'scene_background', key: s.scene_key,
          label: `${s.scene_key} — ${s.title ?? 'Untitled scene'}`,
          guidance: visualBrief(s.author_notes),
          url: isImageUrl(s.background_asset) ? s.background_asset : null,
        });
      });
      (pkg.endings ?? []).forEach((e: any) => {
        next.push({
          id: `ending:${e.ending_key}`, target: 'ending_artwork', key: e.ending_key,
          label: `Ending — ${e.name ?? e.title ?? e.ending_key}`,
          guidance: e.description ?? null,
          url: e.artwork ?? null,
        });
      });
      (pkg.npcs ?? []).forEach((npc: any) => {
        next.push({
          id: `npc:${npc.npc_key}`, target: 'npc_portrait', key: npc.npc_key,
          label: `Character — ${npc.name ?? npc.npc_key}`,
          guidance: [npc.title, npc.description].filter(Boolean).join(' · ') || null,
          url: npc.portrait ?? null,
        });
      });
      // Inline scene images (sequential S15 beats, branch-conditional S13
      // outcomes) live inside a scene as image blocks tagged with an asset_key.
      (pkg.scenes ?? []).forEach((s: any) => {
        (s.blocks ?? []).forEach((b: any) => {
          if (b.block_type === 'image' && b?.metadata?.asset_key) {
            next.push({
              id: `block:${b.metadata.asset_key}`, target: 'scene_block_image', key: b.metadata.asset_key,
              label: `Scene image — ${b.metadata.asset_key} (${s.title ?? s.scene_key})`,
              guidance: b.metadata.alt ?? null,
              url: isImageUrl(b.metadata.src) ? b.metadata.src : null,
            });
          }
        });
      });
      setSlots(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setSlotUrl = (id: string, url: string | null) =>
    setSlots((prev) => prev?.map((s) => (s.id === id ? { ...s, url } : s)) ?? prev);

  const handleUpload = async (slot: Slot, file: File) => {
    setError(null);
    setBusy((b) => ({ ...b, [slot.id]: true }));
    try {
      const url = await uploadJourneyImage(file, campaignId, slot.target, slot.key);
      setSlotUrl(slot.id, url);
    } catch (e) {
      setError(`${slot.label}: ${(e as Error).message}`);
    } finally {
      setBusy((b) => ({ ...b, [slot.id]: false }));
    }
  };

  const handleClear = async (slot: Slot) => {
    setBusy((b) => ({ ...b, [slot.id]: true }));
    try {
      await setJourneyAsset(campaignId, slot.target, slot.key, null);
      setSlotUrl(slot.id, null);
    } catch (e) {
      setError(`${slot.label}: ${(e as Error).message}`);
    } finally {
      setBusy((b) => ({ ...b, [slot.id]: false }));
    }
  };

  const handleBulk = async (files: FileList) => {
    if (!slots) return;
    setError(null);
    setBulkBusy(true);
    setBulkReport(null);
    const uploaded: string[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(files)) {
      const base = (file.name.split('/').pop() || file.name).toLowerCase();
      const slot = slots.find((s) => { const p = fileMatchPattern(s); return p ? p.test(base) : false; });
      if (!slot) { skipped.push(file.name); continue; }
      try {
        const url = await uploadJourneyImage(file, campaignId, slot.target, slot.key);
        setSlotUrl(slot.id, url);
        uploaded.push(slot.label);
      } catch (e) {
        skipped.push(`${file.name} — ${(e as Error).message}`);
      }
    }
    setBulkBusy(false);
    setBulkReport({ uploaded, skipped });
  };

  const filled = slots?.filter((s) => isImageUrl(s.url)).length ?? 0;

  return createPortal(
    <div
      className="jy-mode fixed inset-0 z-[60] flex items-stretch justify-center sm:items-center"
      style={{ background: 'hsl(28 14% 4% / 0.85)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Illustrate ${title}`}
      onClick={onClose}
    >
      <div
        className="jy-panel-raised jy-fade-in flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden sm:rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: 'hsl(var(--jy-border-subtle))' }}>
          <div className="min-w-0">
            <div className="jy-eyebrow">Illustrate the journey</div>
            <h2 className="jy-display mt-0.5 truncate text-xl">{title}</h2>
            {slots && <p className="jy-muted mt-1 text-xs">{filled} of {slots.length} slots have art</p>}
          </div>
          <button className="jy-btn jy-btn-ghost jy-btn-sm shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="overflow-auto p-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom,0px))' }}>
          <p className="jy-secondary mb-4 rounded-sm p-3 text-xs" style={{ background: 'hsl(var(--jy-gold) / 0.08)', border: '1px solid hsl(var(--jy-gold) / 0.25)' }}>
            Uploads are saved to this campaign’s draft. <strong>Publish</strong> from the Studio to make the art live for players, and <strong>Export</strong> if you want to save the image links back into the campaign file.
          </p>

          {/* Bulk import — drop a whole folder; files match slots by filename. */}
          <div className="jy-panel mb-4 p-4">
            <div className="flex items-center gap-2">
              <FolderUp className="h-4 w-4" style={{ color: 'hsl(var(--jy-gold))' }} aria-hidden />
              <span className="jy-display text-sm">Bulk import</span>
            </div>
            <p className="jy-muted mt-1 text-xs">
              Choose all your exported PNGs at once — each is matched to its slot by filename
              (<code>tdb-scene-&lt;code&gt;</code> → scene, <code>tdb-character-&lt;name&gt;</code> → portrait).
              Anything it can’t place is listed so you can handle it by hand.
            </p>
            <input
              ref={bulkInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) void handleBulk(e.target.files); e.target.value = ''; }}
            />
            <button
              className="jy-btn jy-btn-sm jy-btn-primary mt-3"
              disabled={bulkBusy || !slots}
              onClick={() => bulkInputRef.current?.click()}
            >
              <FolderUp className="h-3.5 w-3.5" aria-hidden /> {bulkBusy ? 'Importing…' : 'Choose files'}
            </button>
            {bulkReport && (
              <div className="mt-3 text-xs">
                <p style={{ color: 'hsl(150 30% 62%)' }}>Uploaded {bulkReport.uploaded.length} file(s).</p>
                {bulkReport.skipped.length > 0 && (
                  <details className="mt-1">
                    <summary className="jy-muted cursor-pointer">Skipped {bulkReport.skipped.length} (no matching slot)</summary>
                    <ul className="jy-muted mt-1 space-y-0.5">
                      {bulkReport.skipped.map((n, i) => <li key={i}>· {n}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="mb-4 text-sm" style={{ color: 'hsl(var(--jy-blood))' }}>{error}</p>
          )}

          {!slots ? (
            <p className="jy-muted text-sm">Loading slots…</p>
          ) : (
            <div className="space-y-3">
              {slots.map((slot) => (
                <ImageSlotRow
                  key={slot.id}
                  slot={slot}
                  busy={!!busy[slot.id]}
                  onUpload={(f) => handleUpload(slot, f)}
                  onClear={() => handleClear(slot)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Regex that matches an exported filename to a slot, following the manifest's
 * naming convention (tdb-scene-<code>-…, tdb-character-<name>-…). Returns null
 * for slots that have no filename convention (cover / hero / endings), which
 * are left for manual upload. Theron requires the "canonical" file so the
 * stormscar variant doesn't claim the portrait slot.
 */
function fileMatchPattern(slot: Slot): RegExp | null {
  const k = slot.key.toLowerCase();
  if (slot.target === 'scene_background' || slot.target === 'scene_block_image') {
    return new RegExp(`^tdb-scene-${k}-`);
  }
  if (slot.target === 'npc_portrait') {
    return slot.key === 'theron'
      ? /^tdb-character-theron-canonical/
      : new RegExp(`^tdb-character-${k}-`);
  }
  return null;
}

function ImageSlotRow({
  slot, busy, onUpload, onClear,
}: { slot: Slot; busy: boolean; onUpload: (f: File) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const has = isImageUrl(slot.url);

  return (
    <article className="jy-panel flex gap-3 p-3">
      <div
        className="relative h-20 w-28 shrink-0 overflow-hidden rounded-sm"
        style={{ border: '1px solid hsl(var(--jy-border-subtle))', background: 'hsl(var(--jy-bg-primary))' }}
      >
        {has ? (
          <img src={slot.url as string} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ImagePlus className="h-5 w-5" style={{ color: 'hsl(var(--jy-text-muted))' }} aria-hidden />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="jy-display text-sm">{slot.label}</div>
        {slot.guidance && <p className="jy-muted mt-0.5 line-clamp-3 text-xs italic">{slot.guidance}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
          <button className="jy-btn jy-btn-sm jy-btn-ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
            <UploadCloud className="h-3.5 w-3.5" aria-hidden /> {busy ? 'Uploading…' : has ? 'Replace' : 'Upload'}
          </button>
          {has && !busy && (
            <button className="jy-btn jy-btn-sm jy-btn-ghost" onClick={onClear} aria-label="Remove image">
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
