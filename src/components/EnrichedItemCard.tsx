import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ImageOff, Sparkles, RefreshCw } from 'lucide-react';
import type { ItemEnrichment } from '@/hooks/useItemEnrichments';

interface EnrichedItemCardProps {
  label: string;
  rank: number;
  enrichment?: ItemEnrichment;
  showRank?: boolean;
  compact?: boolean;
  onClick?: () => void;
  onImageClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

// Category-specific gradient fallbacks
const categoryGradients: Record<string, string> = {
  movie: 'from-purple-900/40 to-indigo-900/40',
  tv: 'from-blue-900/40 to-cyan-900/40',
  book: 'from-amber-900/40 to-orange-900/40',
  music: 'from-pink-900/40 to-rose-900/40',
  food: 'from-red-900/40 to-orange-900/40',
  brand: 'from-slate-800/40 to-zinc-900/40',
  sport: 'from-green-900/40 to-emerald-900/40',
  game: 'from-violet-900/40 to-fuchsia-900/40',
  person: 'from-sky-900/40 to-blue-900/40',
  generic: 'from-slate-800/40 to-gray-900/40',
};

function MetadataSubtitle({ enrichment }: { enrichment?: ItemEnrichment }) {
  if (!enrichment?.metadata) return null;
  const m = enrichment.metadata;
  const parts: string[] = [];

  if (m.year) parts.push(String(m.year));
  if (m.director) parts.push(m.director);
  if (m.author) parts.push(m.author);
  if (m.artist) parts.push(m.artist);
  if (m.genre) parts.push(typeof m.genre === 'string' ? m.genre : Array.isArray(m.genre) ? m.genre[0] : '');
  if (m.network) parts.push(m.network);
  if (m.cuisine) parts.push(m.cuisine);
  if (m.type) parts.push(String(m.type));
  if (m.known_for) parts.push(m.known_for);

  const validParts = parts.filter(Boolean).slice(0, 3);
  if (!validParts.length) return null;

  return (
    <span className="text-[10px] text-muted-foreground/60 font-medium block mt-0.5 break-words">
      {validParts.join(' · ')}
    </span>
  );
}

export default function EnrichedItemCard({
  label,
  rank,
  enrichment,
  showRank = true,
  compact = false,
  onClick,
  onImageClick,
  actions,
  className,
}: EnrichedItemCardProps) {
  const hasImage = enrichment?.image_url || enrichment?.thumbnail_url;
  const imageUrl = enrichment?.thumbnail_url || enrichment?.image_url;
  const category = enrichment?.category || 'generic';
  const gradient = categoryGradients[category] || categoryGradients.generic;
  const isLowConfidence = enrichment?.status === 'low_confidence';
  const hasImageCandidates = onImageClick && (enrichment?.metadata?.image_candidates as any[])?.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 group card-tilt rounded-xl",
        "transition-colors duration-150 hover:bg-muted/20",
        // Faint gold wash so the leader reads as the top pick at a glance.
        rank === 1 && showRank && "bg-gradient-to-r from-gold/[0.06] via-transparent to-transparent",
        onClick && "cursor-pointer active:bg-primary/5",
        className
      )}
      onClick={onClick}
    >
      {/* Rank badge — podium medals for the top 3, muted pill below. */}
      {showRank && (
        rank <= 3 ? (
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 border",
            rank === 1 && "bg-gold/20 text-gold border-gold/45 shadow-[0_0_12px_hsl(var(--gold)/0.28)]",
            rank === 2 && "bg-silver/20 text-silver border-silver/45",
            rank === 3 && "bg-bronze/20 text-bronze border-bronze/45",
          )}>
            {rank}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
            {rank}
          </div>
        )
      )}

      {/* Image thumbnail */}
      <div
        className={cn(
          "relative flex-shrink-0 rounded-xl overflow-hidden ring-1 ring-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.25)]",
          compact ? "w-10 h-10" : "w-12 h-12",
          hasImageCandidates && "cursor-pointer"
        )}
        onClick={hasImageCandidates ? (e) => { e.stopPropagation(); onImageClick?.(); } : undefined}
      >
        {hasImage ? (
          <img
            src={imageUrl!}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            decoding="async"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        {/* Fallback gradient placeholder */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br",
          gradient,
          hasImage && "hidden"
        )}>
          <span className="text-[15px] font-bold text-foreground/40">
            {label.charAt(0).toUpperCase()}
          </span>
        </div>
        {/* Swap icon overlay */}
        {hasImageCandidates && (
          <div className="absolute inset-0 bg-background/0 hover:bg-background/40 transition-colors flex items-center justify-center group/swap">
            <RefreshCw className="w-3.5 h-3.5 text-foreground/0 group-hover/swap:text-foreground/80 transition-colors" />
          </div>
        )}
        {/* Low confidence indicator */}
        {isLowConfidence && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-warning ring-2 ring-card flex items-center justify-center">
            <span className="text-[7px] font-extrabold text-background leading-none">?</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className={cn(
          "text-[13px] font-semibold block break-words",
          rank === 1 && showRank && "text-gold"
        )}>
          {label}
        </span>
        <MetadataSubtitle enrichment={enrichment} />
      </div>

      {/* Actions slot */}
      {actions && (
        <div className="flex-shrink-0">
          {actions}
        </div>
      )}
    </motion.div>
  );
}

// ─── Skeleton loading card ───
export function EnrichedItemSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="w-6 h-6 rounded-lg skeleton-shimmer" />
      <div className={cn(
        "rounded-lg skeleton-shimmer flex-shrink-0",
        compact ? "w-10 h-10" : "w-12 h-12"
      )} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 rounded-md skeleton-shimmer w-3/4" />
        <div className="h-2.5 rounded-md skeleton-shimmer w-1/2" />
      </div>
    </div>
  );
}
