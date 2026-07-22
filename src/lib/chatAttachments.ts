/**
 * Chat attachment helpers — supports legacy public URLs and new private bucket
 * with on-demand signed URLs (cached in memory).
 *
 * Sentinel scheme for private attachments stored inside message content:
 *   lovable-private://chat-attachments-private/<storage-path>
 *
 * Legacy messages keep using the original Supabase public URL untouched.
 */
import { supabase } from '@/integrations/supabase/client';

export const PRIVATE_BUCKET = 'chat-attachments-private';
export const PRIVATE_URL_PREFIX = `lovable-private://${PRIVATE_BUCKET}/`;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh when within 5 min of expiry

type CacheEntry = { url: string; expiresAt: number; inflight?: Promise<string | null> };
const cache = new Map<string, CacheEntry>();

// Attachment extensions that are images (rendered inline as <img>). Anything
// else stored under the private bucket is a file attachment (rendered as a
// download card). Classification is by extension so legacy image URLs keep
// behaving exactly as before.
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|heic|heif)$/i;

export function isPrivateAttachmentUrl(url: string): boolean {
  return url.startsWith(PRIVATE_URL_PREFIX);
}

/**
 * Storage path from a private sentinel URL. Strips any `#…` metadata fragment
 * (display name) so the value is safe to hand to the storage signer.
 */
export function pathFromPrivateUrl(url: string): string | null {
  if (!isPrivateAttachmentUrl(url)) return null;
  const rest = url.slice(PRIVATE_URL_PREFIX.length);
  const hash = rest.indexOf('#');
  return hash === -1 ? rest : rest.slice(0, hash);
}

/**
 * Build a private sentinel URL, optionally carrying the original display name
 * in a `#n=` fragment (used for the file-attachment card label). The fragment
 * is metadata only — it never reaches storage (see pathFromPrivateUrl).
 */
export function buildPrivateAttachmentUrl(path: string, name?: string): string {
  const base = `${PRIVATE_URL_PREFIX}${path}`;
  return name ? `${base}#n=${encodeURIComponent(name)}` : base;
}

/** True if a private attachment URL points at an image (by extension). */
export function isImageAttachmentUrl(url: string): boolean {
  const path = pathFromPrivateUrl(url);
  return path != null && IMAGE_EXT_RE.test(path);
}

/** Original display name carried in a `#n=` fragment, if present. */
export function attachmentDisplayName(url: string): string | null {
  const i = url.indexOf('#n=');
  if (i === -1) return null;
  try { return decodeURIComponent(url.slice(i + 3)); } catch { return null; }
}

/**
 * Resolve a chat attachment URL for rendering.
 *  - Legacy public URLs → returned unchanged.
 *  - Private sentinel URLs → resolved to a short-lived signed URL (cached).
 *  - Returns null if signing fails (caller can show error/retry state).
 */
export async function resolveAttachmentUrl(url: string): Promise<string | null> {
  if (!isPrivateAttachmentUrl(url)) return url;
  const path = pathFromPrivateUrl(url);
  if (!path) return null;

  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt - now > REFRESH_BEFORE_MS) {
    return cached.url;
  }
  if (cached?.inflight) return cached.inflight;

  const inflight = (async () => {
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      cache.delete(path);
      return null;
    }
    cache.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  })();

  cache.set(path, { url: cached?.url ?? '', expiresAt: cached?.expiresAt ?? 0, inflight });
  const result = await inflight;
  const entry = cache.get(path);
  if (entry) delete entry.inflight;
  return result;
}

/** Force-invalidate a cached signed URL (e.g. after a 403 from CDN). */
export function invalidateAttachmentUrl(url: string) {
  const path = pathFromPrivateUrl(url);
  if (path) cache.delete(path);
}
