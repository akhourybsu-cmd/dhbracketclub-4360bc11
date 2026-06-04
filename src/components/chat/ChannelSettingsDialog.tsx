import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Bell, AtSign, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Channel, Category, ChannelType, PostPermission, NotificationMode } from './types';
import { CHANNEL_TYPE_META, CHANNEL_TYPE_ORDER } from './channelTypeMeta';

const EMOJI_OPTIONS = [
  '💬', '📢', '🏀', '🎬', '🍕', '🎲', '✈️', '🏆',
  '🎮', '🎵', '📚', '🏈', '⚽', '🎯', '💡', '🔥',
  '❤️', '🌍', '📸', '🛠️', '💰', '🎤', '🐶', '🚀',
];

type ChannelUpdates = Partial<Pick<Channel, 'name' | 'description' | 'icon' | 'category_id' | 'is_default' | 'channel_type' | 'post_permission'>>;

interface ChannelSettingsDialogProps {
  channel: Channel;
  categories: Category[];
  open: boolean;
  isAdmin?: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (channelId: string, updates: ChannelUpdates) => Promise<boolean>;
  onDelete: (channelId: string) => void;
}

const TYPE_OPTIONS = CHANNEL_TYPE_ORDER.map(id => ({ id, ...CHANNEL_TYPE_META[id] }));

const NOTIF_OPTIONS: { value: NotificationMode; label: string; hint: string; icon: typeof Bell }[] = [
  { value: 'all', label: 'All messages', hint: 'Notify me for every new message', icon: Bell },
  { value: 'mentions', label: 'Mentions only', hint: 'Just @mentions and replies to me', icon: AtSign },
  { value: 'muted', label: 'Muted', hint: 'No push notifications from this channel', icon: BellOff },
];

export function ChannelSettingsDialog({ channel, categories, open, isAdmin, onOpenChange, onUpdate, onDelete }: ChannelSettingsDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [icon, setIcon] = useState(channel.icon || '');
  const [categoryId, setCategoryId] = useState(channel.category_id || '');
  const [isDefault, setIsDefault] = useState(channel.is_default);
  const [channelType, setChannelType] = useState<ChannelType>(channel.channel_type || 'general');
  const [postPermission, setPostPermission] = useState<PostPermission>(channel.post_permission || 'all');
  const [saving, setSaving] = useState(false);

  // Per-user notification preference for this channel
  const [notifMode, setNotifMode] = useState<NotificationMode>('all');
  const [notifSaving, setNotifSaving] = useState(false);

  // Reset form state whenever the channel changes OR dialog opens
  useEffect(() => {
    if (!open) return;
    setName(channel.name);
    setDescription(channel.description || '');
    setIcon(channel.icon || '');
    setCategoryId(channel.category_id || '');
    setIsDefault(channel.is_default);
    setChannelType(channel.channel_type || 'general');
    setPostPermission(channel.post_permission || 'all');
  }, [channel.id, open]);

  // Load this user's notification preference for the channel
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('channel_notification_prefs')
        .select('mode')
        .eq('channel_id', channel.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) setNotifMode((data?.mode as NotificationMode) || 'all');
    })();
    return () => { cancelled = true; };
  }, [open, user?.id, channel.id]);

  const handleSetNotifMode = async (next: NotificationMode) => {
    if (!user || notifSaving || next === notifMode) return;
    setNotifSaving(true);
    const prev = notifMode;
    setNotifMode(next);
    const { error } = await (supabase as any)
      .from('channel_notification_prefs')
      .upsert(
        { user_id: user.id, channel_id: channel.id, mode: next },
        { onConflict: 'user_id,channel_id' }
      );
    if (error) {
      setNotifMode(prev);
      toast.error('Could not update notifications');
    }
    setNotifSaving(false);
  };

  // Announcements + admin_only imply admin-only posting; keep state in sync.
  const effectivePermission: PostPermission =
    channelType === 'announcements' || channelType === 'admin_only' ? 'admins' : postPermission;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const sanitizedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    const success = await onUpdate(channel.id, {
      name: sanitizedName,
      description: description.trim() || null,
      icon: icon || null,
      category_id: categoryId || null,
      is_default: isDefault,
      channel_type: channelType,
      post_permission: effectivePermission,
    });
    setSaving(false);
    if (success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85dvh] p-0 rounded-2xl flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0 flex-shrink-0">
          <DialogTitle className="text-base font-bold">
            {isAdmin ? 'Channel Settings' : `#${channel.name}`}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 pb-5 pt-3 space-y-5">
            {/* Notifications — visible to ALL members */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Notifications</Label>
              <div className="space-y-1.5">
                {NOTIF_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const selected = notifMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={notifSaving}
                      onClick={() => handleSetNotifMode(opt.value)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                        selected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border/30 hover:bg-muted/40',
                        notifSaving && 'opacity-60'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 flex-shrink-0', selected ? 'text-primary' : 'text-muted-foreground/70')} />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[13px] font-bold leading-tight', selected ? 'text-primary' : 'text-foreground/90')}>
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">{opt.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {isAdmin && <Separator />}

            {/* Admin-only: Channel configuration */}
            {isAdmin && (
              <>
                {/* Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Channel Name</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="channel-name"
                    className="h-10 text-sm"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What's this channel about?"
                    className="text-sm resize-none min-h-[60px]"
                    rows={2}
                  />
                </div>

                {/* Emoji/Icon */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Icon</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setIcon('')}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs border transition-all ${!icon ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border/30 hover:bg-muted/50'}`}
                    >
                      #
                    </button>
                    {EMOJI_OPTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => setIcon(e)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${icon === e ? 'border border-primary bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Category</Label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Channel type */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Channel Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPE_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const selected = channelType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setChannelType(opt.id)}
                          className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition-all ${
                            selected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                              : 'border-border/30 hover:bg-muted/40'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground/70'}`} />
                          <div className="min-w-0">
                            <p className={`text-[12px] font-bold ${selected ? 'text-primary' : 'text-foreground/85'}`}>{opt.label}</p>
                            <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{opt.hint}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Post permission */}
                {channelType === 'general' && (
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <Label className="text-xs font-semibold">Admins-only Posting</Label>
                      <p className="text-[11px] text-muted-foreground/70">Members can still read; only admins can post.</p>
                    </div>
                    <Switch
                      checked={postPermission === 'admins'}
                      onCheckedChange={(v) => setPostPermission(v ? 'admins' : 'all')}
                    />
                  </div>
                )}

                {/* Default toggle */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <Label className="text-xs font-semibold">Default Channel</Label>
                    <p className="text-[11px] text-muted-foreground/70">New users land here first</p>
                  </div>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>

                <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full h-10 text-sm font-bold">
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>

                <Separator />

                {/* Danger zone */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/70">Danger Zone</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full h-9 text-xs gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Delete Channel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete #{channel.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the channel and all its messages, reactions, and read states. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => { onDelete(channel.id); onOpenChange(false); }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
