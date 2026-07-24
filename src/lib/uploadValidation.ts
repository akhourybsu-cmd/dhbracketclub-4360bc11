/**
 * Centralized client-side upload validation. Defense-in-depth only —
 * server-side storage policies + bucket configuration remain authoritative.
 *
 * Goals:
 *  - Block obviously-wrong MIME types early (faster UX, less bandwidth).
 *  - Pin file extensions to a known-safe allowlist so we never write a
 *    user-supplied `.html`, `.svg`, or `.exe` into a public bucket.
 *  - Sanitize error messages so we don't surface raw provider errors
 *    (which can leak bucket names, paths, or internal IDs).
 */

export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export const SAFE_IMAGE_EXTENSIONS = new Set(Object.values(MIME_TO_EXT));

// Non-image chat attachments (documents, media, archives). Extension is
// derived from MIME — never from the filename — and pinned to this allowlist
// so we never write an executable/HTML into shared storage.
const FILE_MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
export const SAFE_FILE_EXTENSIONS = new Set(Object.values(FILE_MIME_TO_EXT));
/** Comma-separated accept string for a non-image file <input>. */
export const FILE_ACCEPT = Object.keys(FILE_MIME_TO_EXT).join(',');

export interface FileValidationResult { ok: boolean; error?: string; ext?: string }

/** Validate a non-image file attachment (size + MIME allowlist). */
export function validateAttachmentFile(
  file: File,
  opts: { maxBytes: number },
): FileValidationResult {
  const label = file?.name || 'File';
  if (!file || file.size === 0) return { ok: false, error: `${label} is empty` };
  const ext = FILE_MIME_TO_EXT[file.type];
  if (!ext) return { ok: false, error: `${label}: unsupported file type` };
  if (file.size > opts.maxBytes) {
    const mb = Math.round(opts.maxBytes / (1024 * 1024));
    return { ok: false, error: `${label} exceeds ${mb}MB limit` };
  }
  return { ok: true, ext };
}

export interface ImageValidationOptions {
  maxBytes: number;
  /** Optional human-friendly label used in toast messages. */
  label?: string;
}

export interface ImageValidationResult {
  ok: boolean;
  /** User-facing error string when ok=false. */
  error?: string;
  /** Sanitized extension (no leading dot) when ok=true. */
  ext?: string;
}

/** Map a filename to a safe image extension, or null. `jpeg` → `jpg`. */
function imageExtFromName(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const norm = raw === 'jpeg' ? 'jpg' : raw;
  return SAFE_IMAGE_EXTENSIONS.has(norm) ? norm : null;
}

export function validateImageFile(
  file: File,
  opts: ImageValidationOptions,
): ImageValidationResult {
  const label = opts.label ?? 'Image';

  if (!file || file.size === 0) {
    return { ok: false, error: `${label} is empty` };
  }

  // Prefer the MIME type, but fall back to the filename extension when the
  // browser reports an empty/unknown type. Photo-library pickers on iOS
  // (HEIC), screenshots, and some gallery apps routinely hand us a File with
  // `type === ''`, which the strict MIME check used to reject outright — the
  // "photo library doesn't upload" bug. The extension is still pinned to the
  // safe allowlist, so nothing unsafe slips through.
  let ext = MIME_TO_EXT[file.type];
  if (!ext) ext = imageExtFromName(file.name) ?? undefined;
  if (!ext) {
    return {
      ok: false,
      error: `${label} must be a JPG, PNG, WEBP, GIF, or HEIC file`,
    };
  }

  if (file.size > opts.maxBytes) {
    const mb = Math.round(opts.maxBytes / (1024 * 1024));
    return { ok: false, error: `${label} exceeds ${mb}MB limit` };
  }

  return { ok: true, ext };
}

const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime]),
);

/** Best-effort MIME for a stored extension — used to set a correct
 *  content-type on upload when the browser gave us an empty `file.type`. */
export function mimeForExt(ext: string): string | undefined {
  return EXT_TO_MIME[ext];
}

/**
 * Map provider errors (Supabase Storage, network failures, etc.) to a
 * generic, user-safe message. Logs the raw error for diagnostics but never
 * surfaces it directly — provider errors can include bucket paths,
 * internal IDs, or hint at policy structure.
 */
export function sanitizeUploadError(err: unknown, fallback = 'Upload failed'): string {
  // eslint-disable-next-line no-console
  console.error('[upload]', err);
  // We intentionally do not return err.message — see comment above.
  return fallback;
}

/** Build a non-guessable storage path under a user-scoped folder. */
export function buildUserScopedPath(userId: string, ext: string, prefix?: string): string {
  const safeExt = SAFE_IMAGE_EXTENSIONS.has(ext) || SAFE_FILE_EXTENSIONS.has(ext) ? ext : 'bin';
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now();
  const base = `${stamp}-${rand}.${safeExt}`;
  return prefix ? `${userId}/${prefix}/${base}` : `${userId}/${base}`;
}
