import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { Send, Plus, Image, Camera, X, Loader2, ImagePlay } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { UserAvatar } from './UserAvatar';
import { supabase } from '@/integrations/supabase/client';
import { validateImageFile, buildUserScopedPath, sanitizeUploadError } from '@/lib/uploadValidation';
import { GifPicker } from './GifPicker';
import { isGifProviderConfigured } from '@/lib/gifProvider';

export interface MentionMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface MessageComposerHandle {
  focus: () => void;
}

export interface PendingImage {
  file: File;
  previewUrl: string;
}

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (imageUrls?: string[]) => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  members?: MentionMember[];
  userId?: string;
}

export const MessageComposer = forwardRef<MessageComposerHandle, MessageComposerProps>(
  ({ value, onChange, onSend, onTyping, disabled, placeholder, compact, autoFocus, members = [], userId }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const dragDepth = useRef(0);

    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState(0);

    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const gifEnabled = isGifProviderConfigured();

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    const resize = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const lineHeight = compact ? 20 : 22;
      const maxLines = 4;
      const maxHeight = lineHeight * maxLines + 16;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, [compact]);

    useEffect(() => { resize(); }, [value, resize]);

    useEffect(() => {
      if (autoFocus) {
        const t = setTimeout(() => textareaRef.current?.focus(), 150);
        return () => clearTimeout(t);
      }
    }, [autoFocus]);

    useEffect(() => {
      if (!showAttachMenu) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setShowAttachMenu(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [showAttachMenu]);

    const detectMention = useCallback(() => {
      const el = textareaRef.current;
      if (!el || members.length === 0) { setMentionQuery(null); return; }
      const cursor = el.selectionStart;
      const text = el.value;
      let i = cursor - 1;
      while (i >= 0 && text[i] !== '@' && text[i] !== ' ' && text[i] !== '\n') i--;
      if (i >= 0 && text[i] === '@' && (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n')) {
        setMentionQuery(text.slice(i + 1, cursor));
        setMentionStart(i);
        setMentionIndex(0);
      } else {
        setMentionQuery(null);
      }
    }, [members]);

    const filteredMembers = mentionQuery !== null
      ? members.filter(m => m.display_name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
      : [];

    const insertMention = useCallback((member: MentionMember) => {
      const el = textareaRef.current;
      if (!el) return;
      const before = value.slice(0, mentionStart);
      const after = value.slice(el.selectionStart);
      const mention = `@${member.display_name} `;
      onChange(before + mention + after);
      setMentionQuery(null);
      requestAnimationFrame(() => {
        const pos = before.length + mention.length;
        el.selectionStart = el.selectionEnd = pos;
        el.focus();
      });
    }, [value, mentionStart, onChange]);

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const MAX_IMAGES = 4;

    // Single funnel for every image source: the file picker, camera, clipboard
    // paste, and drag-and-drop all land here. Validates, caps at MAX_IMAGES,
    // and builds object-URL previews.
    const addFiles = (incoming: File[]) => {
      const accepted: File[] = [];
      for (const f of incoming) {
        const v = validateImageFile(f, { maxBytes: MAX_FILE_SIZE, label: f.name || 'Image' });
        if (!v.ok) { toast.error(v.error!); continue; }
        accepted.push(f);
      }
      if (accepted.length === 0) return;
      setPendingImages(prev => {
        if (prev.length >= MAX_IMAGES) {
          toast.error(`You can attach up to ${MAX_IMAGES} images`);
          return prev;
        }
        const room = MAX_IMAGES - prev.length;
        const newPending = accepted.slice(0, room).map(file => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        return [...prev, ...newPending];
      });
      setShowAttachMenu(false);
    };

    const handleFilesSelected = (files: FileList | null) => {
      if (files) addFiles(Array.from(files));
    };

    // Paste an image straight into the composer (screenshots, copied images).
    // Text paste falls through to the browser's default behavior untouched.
    const handlePaste = (e: React.ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length > 0) {
        e.preventDefault(); // don't also drop a stray filename into the text
        addFiles(imgs);
      }
    };

    // Drag-and-drop images onto the composer (desktop). dragDepth tracks
    // enter/leave across nested children so the overlay doesn't flicker.
    const dragHasFiles = (e: React.DragEvent) =>
      Array.from(e.dataTransfer?.types || []).includes('Files');
    const handleDragEnter = (e: React.DragEvent) => {
      if (disabled || !dragHasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    };
    const handleDragOver = (e: React.DragEvent) => {
      if (!disabled && dragHasFiles(e)) e.preventDefault();
    };
    const handleDragLeave = () => {
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) { dragDepth.current = 0; setIsDragging(false); }
    };
    const handleDrop = (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
      if (dropped.length) addFiles(dropped);
    };

    const removePendingImage = (index: number) => {
      setPendingImages(prev => {
        const removed = prev[index];
        URL.revokeObjectURL(removed.previewUrl);
        return prev.filter((_, i) => i !== index);
      });
    };

    useEffect(() => {
      return () => {
        pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl));
      };
    }, []);

    const uploadImages = async (): Promise<string[]> => {
      if (!userId || pendingImages.length === 0) return [];
      const results = await Promise.all(
        pendingImages.map(async (pending) => {
          // Re-validate to derive a safe extension from MIME — never trust
          // the original filename when writing into shared storage.
          const v = validateImageFile(pending.file, { maxBytes: MAX_FILE_SIZE });
          if (!v.ok) { toast.error(v.error!); return null; }
          const path = buildUserScopedPath(userId, v.ext!);
          const { error } = await supabase.storage
            .from('chat-attachments-private')
            .upload(path, pending.file, {
              cacheControl: '3600',
              upsert: false,
              contentType: pending.file.type,
            });
          if (!error) return `lovable-private://chat-attachments-private/${path}`;
          toast.error(sanitizeUploadError(error, 'Failed to upload image'));
          return null;
        })
      );
      return results.filter((url): url is string => url !== null);
    };

    // Picking a GIF sends it immediately (no compose step) — matches
    // iMessage/WhatsApp behavior. Tenor URLs are public CDN, so they
    // bypass the upload path entirely.
    const handleGifSelected = useCallback((url: string) => {
      if (disabled) return;
      onSend([url]);
      setShowGifPicker(false);
      setShowAttachMenu(false);
      // Keep the soft keyboard open after send, same trick as the send button.
      textareaRef.current?.focus();
    }, [disabled, onSend]);

    const handleSend = async () => {
      const hasText = value.trim().length > 0;
      const hasImages = pendingImages.length > 0;
      if ((!hasText && !hasImages) || disabled || uploading) return;

      if (hasImages) {
        setUploading(true);
        try {
          const uploadedUrls = await uploadImages();
          pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl));
          setPendingImages([]);
          onSend(uploadedUrls);
        } catch {
          // keep images on failure
        } finally {
          setUploading(false);
        }
      } else {
        onSend();
      }

      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setMentionQuery(null);
      // Keep the soft keyboard open on mobile after send. Calling focus()
      // synchronously inside the user-initiated handler is what convinces
      // iOS/Android to keep (or re-open) the keyboard. Paired with
      // onMouseDown preventDefault on the send button (below) so focus
      // never actually leaves the textarea on tap.
      textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (mentionQuery !== null && filteredMembers.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(prev => (prev + 1) % filteredMembers.length); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIndex]); return; }
        if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      onTyping?.();
      requestAnimationFrame(detectMention);
    };

    const canSend = (value.trim().length > 0 || pendingImages.length > 0) && !disabled && !uploading;

    return (
      <div
        ref={containerRef}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col bg-background",
          compact ? "px-3 pt-1.5 pb-1.5" : "px-2.5 sm:px-3 pt-1.5"
        )}
        style={{
          paddingBottom: compact ? undefined : 'calc(0.375rem + env(safe-area-inset-bottom, 0px))',
          paddingLeft: `max(${compact ? '0.75rem' : '0.625rem'}, env(safe-area-inset-left, 0px))`,
          paddingRight: `max(${compact ? '0.75rem' : '0.625rem'}, env(safe-area-inset-right, 0px))`,
        }}
      >
        {/* Drag-and-drop overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-1 z-50 flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-primary/50 bg-background/85 backdrop-blur-sm pointer-events-none"
            >
              <Image className="w-5 h-5 text-primary" />
              <span className="text-[12px] font-semibold text-primary">Drop image to attach</span>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Image preview strip */}
        <AnimatePresence>
          {pendingImages.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-2"
            >
              <div className="flex gap-2 overflow-x-auto rounded-2xl bg-muted/10 border border-border/10 p-2">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative flex-shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden border border-border/20 bg-muted/20">
                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePendingImage(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm ring-2 ring-background"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {uploading && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1.5">
          {/* Attach button */}
          {!compact && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                aria-label={showAttachMenu ? 'Close attachment menu' : 'Add attachment'}
                aria-expanded={showAttachMenu}
                type="button"
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90",
                  showAttachMenu
                    ? "bg-primary/15 text-primary rotate-45"
                    : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted/30"
                )}
              >
                <Plus className="w-5 h-5" />
              </button>

              <AnimatePresence>
                {showAttachMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute bottom-full left-0 mb-2 bg-popover/90 backdrop-blur-lg border border-border/20 rounded-xl shadow-xl z-50 overflow-hidden min-w-[170px]"
                  >
                    <button
                      onClick={() => { fileInputRef.current?.click(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40 transition-colors text-foreground/80"
                    >
                      <Image className="w-4 h-4 text-primary/70" />
                      <span className="font-medium">Photo Library</span>
                    </button>
                    <button
                      onClick={() => { cameraInputRef.current?.click(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40 transition-colors text-foreground/80"
                    >
                      <Camera className="w-4 h-4 text-primary/70" />
                      <span className="font-medium">Take Photo</span>
                    </button>
                    {gifEnabled && (
                      <button
                        onClick={() => { setShowAttachMenu(false); setShowGifPicker(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40 transition-colors text-foreground/80"
                      >
                        <ImagePlay className="w-4 h-4 text-primary/70" />
                        <span className="font-medium">GIF</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { handleFilesSelected(e.target.files); e.target.value = ''; }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { handleFilesSelected(e.target.files); e.target.value = ''; }} />

          <div className="flex-1 relative">
            {/* Mention autocomplete dropdown */}
            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div ref={dropdownRef} className="absolute bottom-full left-0 right-0 mb-1 bg-popover/90 backdrop-blur-lg border border-border/20 rounded-xl shadow-xl z-50 overflow-hidden max-h-[200px] overflow-y-auto">
                {filteredMembers.map((member, i) => (
                  <button
                    key={member.id}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors",
                      i === mentionIndex ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground/80"
                    )}
                  >
                    <UserAvatar userId={member.id} name={member.display_name} avatarUrl={member.avatar_url} size={24} />
                    <span className="font-medium truncate">{member.display_name}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onSelect={detectMention}
              onPaste={handlePaste}
              placeholder={placeholder || 'Message'}
              rows={1}
              className={cn(
                "w-full resize-none bg-muted/30 border border-border/20 rounded-[20px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/30 transition-colors duration-150 placeholder:text-muted-foreground/45",
                compact ? "text-xs pl-3.5 pr-3.5 py-2" : "text-[15px] pl-4 pr-4 py-2"
              )}
              autoComplete="off"
              style={{ minHeight: compact ? 36 : 38, maxHeight: compact ? 96 : 120, lineHeight: 1.4 }}
            />
          </div>

          {/* Send button — external, circular */}
          <button
            onClick={handleSend}
            onMouseDown={(e) => { e.preventDefault(); /* keep keyboard open: don't transfer focus */ }}
            disabled={!canSend}
            aria-label={uploading ? 'Sending message' : 'Send message'}
            type="button"
            className={cn(
              // Mobile bumped to 44×44 (Apple HIG primary action min)
              // so the most-tapped affordance in the app is comfortably
              // thumb-sized. Desktop stays at 36×36 since it's typically
              // a click target.
              "flex-shrink-0 w-11 h-11 lg:w-9 lg:h-9 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 disabled:cursor-not-allowed",
              canSend
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground/40"
            )}
          >
            {uploading
              ? <Loader2 className={cn(compact ? "w-4 h-4" : "w-[17px] h-[17px]", "animate-spin")} />
              : <Send className={cn(compact ? "w-4 h-4" : "w-[16px] h-[16px]", "translate-x-px")} />
            }
          </button>
        </div>

        {/* GIF picker — portaled bottom-sheet, only when configured */}
        {gifEnabled && (
          <AnimatePresence>
            {showGifPicker && (
              <GifPicker
                open={showGifPicker}
                onClose={() => setShowGifPicker(false)}
                onSelect={handleGifSelected}
              />
            )}
          </AnimatePresence>
        )}
      </div>
    );
  }
);

MessageComposer.displayName = 'MessageComposer';
