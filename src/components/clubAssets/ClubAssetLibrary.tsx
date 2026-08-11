import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Package, Loader2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useClubAssets } from '@/hooks/useClubAssets';
import { AssetCard } from './AssetCard';
import { InstallAssetSheet } from './InstallAssetSheet';
import type { PlatformAsset, InstalledAsset } from '@/types/assets';
import { toast } from 'sonner';

type FilterTab = 'all' | 'installed' | 'games' | 'social' | 'events' | 'admin-tools' | 'experimental';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',          label: 'All' },
  { id: 'installed',    label: 'Installed' },
  { id: 'games',        label: 'Games' },
  { id: 'social',       label: 'Social' },
  { id: 'events',       label: 'Events' },
  { id: 'admin-tools',  label: 'Admin' },
  { id: 'experimental', label: 'Beta' },
];

/** Pull a user-facing error message off a thrown PostgrestError / Error / unknown. */
function errMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string };
    return e.message || e.details || e.hint || 'Something went wrong';
  }
  return 'Something went wrong';
}

export function ClubAssetLibrary() {
  const {
    allAssets, installedAssets, loading,
    pendingInstall, pendingUninstall, pendingToggle,
    install, uninstall, restore,
    setEnabled, setVisible,
  } = useClubAssets();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [sheetAsset, setSheetAsset] = useState<PlatformAsset | null>(null);
  // Sheet's own pending state — separate from the per-card pending sets so
  // the sheet's "Installing…" button locks independently.
  const [sheetInstalling, setSheetInstalling] = useState(false);

  const installedMap = useMemo(() =>
    new Map(installedAssets.map(ia => [ia.asset_id, ia])),
    [installedAssets]);

  const filtered = useMemo(() => {
    let assets = allAssets;
    if (activeTab === 'installed') {
      assets = assets.filter(a => installedMap.has(a.id));
    } else if (activeTab !== 'all') {
      assets = assets.filter(a => a.category === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      assets = assets.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.short_description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
      );
    }
    return assets;
  }, [allAssets, installedMap, activeTab, search]);

  const installedCount = installedAssets.length;

  /** One-tap install path — used for zero-config assets. Inline spinner + subtle toast. */
  const handleQuickInstall = useCallback(async (asset: PlatformAsset) => {
    try {
      await install(asset.id);
      toast.success(`${asset.name} added`, {
        description: 'Members can use it now.',
        duration: 2200,
      });
    } catch (err) {
      toast.error(`Couldn't install ${asset.name}`, {
        description: errMessage(err),
      });
    }
  }, [install]);

  /** Sheet install path — used for configurable assets. Sheet shows its own state. */
  const handleSheetInstall = useCallback(async (asset: PlatformAsset) => {
    setSheetInstalling(true);
    try {
      await install(asset.id);
    } catch (err) {
      toast.error(`Couldn't install ${asset.name}`, {
        description: errMessage(err),
      });
      throw err; // let the sheet stay on confirm step
    } finally {
      setSheetInstalling(false);
    }
  }, [install]);

  /** Uninstall with a 5-second Undo toast — the row is removed optimistically. */
  const handleUninstall = useCallback(async (installed: InstalledAsset) => {
    const snapshot = installed;
    const name = installed.asset.name;
    try {
      await uninstall(installed.id);
      toast.success(`${name} removed`, {
        description: 'Tap undo to restore.',
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            restore(snapshot).catch(err => {
              toast.error(`Couldn't restore ${name}`, { description: errMessage(err) });
            });
          },
        },
      });
    } catch (err) {
      toast.error(`Couldn't remove ${name}`, { description: errMessage(err) });
    }
  }, [uninstall, restore]);

  const handleToggleEnabled = useCallback(async (installed: InstalledAsset) => {
    const next = !installed.enabled;
    try {
      await setEnabled(installed.id, next);
      // No toast spam — the card itself flips state. Quiet success is good UX.
    } catch (err) {
      toast.error(`Couldn't ${next ? 'enable' : 'disable'} ${installed.asset.name}`, {
        description: errMessage(err),
      });
    }
  }, [setEnabled]);

  const handleToggleVisible = useCallback(async (installed: InstalledAsset) => {
    const next = !installed.visible_to_members;
    try {
      await setVisible(installed.id, next);
    } catch (err) {
      toast.error(`Couldn't ${next ? 'show' : 'hide'} ${installed.asset.name}`, {
        description: errMessage(err),
      });
    }
  }, [setVisible]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-[17px] tracking-tight">Asset Library</h2>
          <p className="text-[11px] text-muted-foreground/65 mt-0.5">
            {installedCount > 0
              ? `${installedCount} asset${installedCount !== 1 ? 's' : ''} installed`
              : 'No assets installed — browse below to add features'}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/15">
          <Package className="w-4.5 h-4.5 text-primary/80" />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search features…"
          className="pl-9 pr-9 h-9 text-sm bg-muted/20 border-border/20 rounded-xl"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/50"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground/60" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-0.5 px-0.5">
        {TABS.map(tab => {
          const count = tab.id === 'installed'
            ? installedCount
            : tab.id === 'all'
            ? allAssets.length
            : allAssets.filter(a => a.category === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-3 h-7 rounded-full text-[11px] font-bold transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/30 text-muted-foreground/70 hover:bg-muted/50 border border-border/15',
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'text-[9px] font-extrabold px-1 py-0.5 rounded-full min-w-[16px] text-center',
                  activeTab === tab.id ? 'bg-white/20' : 'bg-muted/60',
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* One-tap install hint — only shown when nothing is installed yet so
          users learn the new affordance without feeling lectured to. */}
      {installedCount === 0 && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15"
        >
          <Sparkles className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
          <p className="text-[11px] text-foreground/80 leading-snug">
            Tap <span className="font-bold text-primary">Add to Club</span> on any asset to install it instantly.
            Configurable assets open a setup card before installing.
          </p>
        </motion.div>
      )}

      {/* Asset grid */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground/60">
              {search ? 'No assets match your search' : 'Nothing in this category yet'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(asset => {
              const installed = installedMap.get(asset.id);
              return (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  installed={installed}
                  requiresSheet={asset.requires_configuration}
                  isInstalling={pendingInstall.has(asset.id)}
                  isUninstalling={installed ? pendingUninstall.has(installed.id) : false}
                  isToggling={installed ? pendingToggle.has(installed.id) : false}
                  onInstall={a => setSheetAsset(a)}
                  onQuickInstall={handleQuickInstall}
                  onUninstall={handleUninstall}
                  onConfigure={ia => toast.info(`Configure ${ia.asset.name} — coming soon`)}
                  onToggleEnabled={handleToggleEnabled}
                  onToggleVisible={handleToggleVisible}
                />
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Install bottom sheet — only used when the asset needs configuration */}
      <InstallAssetSheet
        asset={sheetAsset}
        open={!!sheetAsset}
        installing={sheetInstalling}
        onClose={() => setSheetAsset(null)}
        onInstall={handleSheetInstall}
        onConfigureNow={a => {
          const route = CONFIG_ROUTES[a.slug];
          if (route) navigate(route);
          else toast.info(`Configure ${a.name} — coming soon`);
        }}
      />
    </div>
  );
}
