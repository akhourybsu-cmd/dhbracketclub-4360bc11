// The Splendid Journey — campaign art uploads.
//
// Uploads an image to the public `journey-art` bucket, then writes its URL into
// the campaign DRAFT via the author-gated `journey_set_asset` RPC. The art
// reaches players on the next publish (gameplay reads the release snapshot).

import { supabase } from '@/integrations/supabase/client';

export type AssetTarget = 'scene_background' | 'ending_artwork' | 'cover_image' | 'hero_image';

const BUCKET = 'journey-art';

/** Upload a file and point the given draft slot at it. Returns the public URL. */
export async function uploadJourneyImage(
  file: File, campaignId: string, target: AssetTarget, key: string,
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const safeKey = (key || 'campaign').replace(/[^a-zA-Z0-9_-]/g, '_');
  // A fresh path per upload keeps caches honest and never overwrites history.
  const stamp = `${Date.now()}${Math.round(performance.now())}`;
  const path = `${campaignId}/${target}-${safeKey}-${stamp}.${ext}`;

  const { error: upErr } = await (supabase as any).storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined, cacheControl: '3600' });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = (supabase as any).storage.from(BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl as string | undefined;
  if (!url) throw new Error('Could not resolve the uploaded image URL.');

  await setJourneyAsset(campaignId, target, key, url);
  return url;
}

/** Point a draft slot at a URL, or pass null to clear it. */
export async function setJourneyAsset(
  campaignId: string, target: AssetTarget, key: string, url: string | null,
): Promise<void> {
  const { error } = await (supabase as any).rpc('journey_set_asset', {
    _campaign_id: campaignId, _target: target, _key: key || '', _url: url,
  });
  if (error) throw new Error(error.message);
}

/** True when a stored value is an uploaded image rather than a legacy keyword. */
export function isImageUrl(value?: string | null): boolean {
  return !!value && /^https?:\/\//.test(value);
}

/** Pull the human "visual_brief" guidance out of a scene's author notes. */
export function visualBrief(authorNotes?: string | null): string | null {
  if (!authorNotes) return null;
  const m = authorNotes.match(/visual_brief[^:]*:\s*([\s\S]+)$/i);
  if (!m) return null;
  return m[1].replace(/ASSET UNRESOLVED\.?/gi, '').trim() || null;
}
