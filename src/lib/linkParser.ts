/**
 * Link parsing and classification for chat messages.
 * Detects URLs, classifies them by type, and extracts embed IDs.
 */

export type LinkContentType = 'image' | 'file' | 'youtube' | 'spotify' | 'link';

export interface ParsedLink {
  url: string;
  contentType: LinkContentType;
  embedId?: string;
  embedType?: string; // e.g. 'track', 'album', 'playlist', 'video'
}

// Match http(s) URLs OR our internal lovable-private:// sentinel for private chat attachments
const URL_RE = /((?:https?|lovable-private):\/\/[^\s<]+)/g;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg|heic)(\?[^\s]*)?$/i;
// Supabase storage URLs contain /object/public/ and are images
const STORAGE_IMAGE_RE = /\/storage\/v1\/object\/public\/chat-attachments\//i;
const PRIVATE_ATTACHMENT_RE = /^lovable-private:\/\/chat-attachments-private\//i;

// YouTube patterns
const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
];

// Spotify patterns
const SPOTIFY_RE = /open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/;

export function extractUrls(text: string): string[] {
  return text.match(URL_RE) || [];
}

export function classifyUrl(url: string): ParsedLink {
  // Private bucket sentinel: an image if its path has an image extension,
  // otherwise a downloadable file attachment. Strip any `#…` metadata
  // fragment before testing the extension.
  if (PRIVATE_ATTACHMENT_RE.test(url)) {
    const path = url.split('#')[0];
    return { url, contentType: IMAGE_EXT_RE.test(path) ? 'image' : 'file' };
  }

  // Public image by extension or Supabase public storage URL
  if (IMAGE_EXT_RE.test(url) || STORAGE_IMAGE_RE.test(url)) {
    return { url, contentType: 'image' };
  }

  // YouTube
  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { url, contentType: 'youtube', embedId: match[1], embedType: 'video' };
    }
  }

  // Spotify
  const spotifyMatch = url.match(SPOTIFY_RE);
  if (spotifyMatch) {
    return {
      url,
      contentType: 'spotify',
      embedType: spotifyMatch[1],
      embedId: spotifyMatch[2],
    };
  }

  return { url, contentType: 'link' };
}

export function parseMessageLinks(text: string): ParsedLink[] {
  const urls = extractUrls(text);
  return urls.map(classifyUrl);
}

/** Sanitize a URL for safe rendering (no javascript:, data: etc.) */
export function isSafeUrl(url: string): boolean {
  if (PRIVATE_ATTACHMENT_RE.test(url)) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
