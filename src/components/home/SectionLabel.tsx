// DH Club Home — calm section label
//
// Replaces the older `SectionHeader` (uppercase 9.5px, tracking-[.22em])
// for the redesigned home shell. Sentence-case, 13px, less shouting,
// more readable. Optional trailing link and count.

import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
  to?: string;
  linkLabel?: string;
  count?: number;
  className?: string;
}

export function SectionLabel({
  label, sublabel, icon: Icon, to, linkLabel = 'See all', count, className,
}: Props) {
  return (
    <div className={cn('flex items-end justify-between gap-3 mb-2.5', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground/70" aria-hidden />}
          <h2 className="text-[14px] font-extrabold tracking-tight text-foreground/90 leading-none">
            {label}
          </h2>
          {count !== undefined && count > 0 && (
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground/60 leading-none ml-0.5">
              {count}
            </span>
          )}
        </div>
        {sublabel && (
          <p className="text-[11.5px] text-muted-foreground/65 leading-tight mt-1 truncate">
            {sublabel}
          </p>
        )}
      </div>
      {to && (
        <Link
          to={to}
          className="text-[11.5px] font-semibold text-muted-foreground/70 hover:text-foreground transition-colors inline-flex items-center gap-0.5 flex-shrink-0"
        >
          {linkLabel} <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
