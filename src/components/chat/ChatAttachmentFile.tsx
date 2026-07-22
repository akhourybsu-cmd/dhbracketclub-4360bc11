import { useState } from 'react';
import { FileText, FileArchive, Film, Music, File as FileIcon, Download, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { resolveAttachmentUrl, attachmentDisplayName, pathFromPrivateUrl } from '@/lib/chatAttachments';

function extOf(url: string): string {
  const path = pathFromPrivateUrl(url) || url;
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

function iconFor(ext: string): LucideIcon {
  if (['mp4', 'mov', 'webm'].includes(ext)) return Film;
  if (['mp3', 'wav', 'm4a'].includes(ext)) return Music;
  if (ext === 'zip') return FileArchive;
  if (['pdf', 'txt', 'csv', 'json', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return FileText;
  return FileIcon;
}

/**
 * Non-image chat attachment (PDF, video, doc, archive, …). Resolves a
 * short-lived signed URL on tap and opens it in a new tab. The display name
 * rides along in the sentinel URL's `#n=` fragment.
 */
export function ChatAttachmentFile({ url }: { url: string }) {
  const [loading, setLoading] = useState(false);
  const ext = extOf(url);
  const Icon = iconFor(ext);
  const name = attachmentDisplayName(url) || `Attachment${ext ? '.' + ext : ''}`;

  const open = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const signed = await resolveAttachmentUrl(url);
    setLoading(false);
    if (signed) window.open(signed, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center gap-2.5 max-w-[280px] rounded-xl border border-border/15 bg-card/60 hover:bg-card/80 transition-colors px-3 py-2.5 text-left"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-[18px] h-[18px] text-primary/80" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-foreground/90 truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{ext || 'file'}</p>
      </div>
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60 flex-shrink-0" />
        : <Download className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />}
    </button>
  );
}
