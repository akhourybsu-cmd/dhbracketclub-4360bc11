import { Sparkles, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  aiContext: string | null;
  aiContextOverride: string | null;
}

/**
 * Discreet info button that reveals the judging scope (AI context / override)
 * for a draft. Visible to all players but tucked away in a popover so it's
 * never intrusive. Renders nothing when there's no scope to show.
 */
export function JudgingScopeButton({ aiContext, aiContextOverride }: Props) {
  const override = (aiContextOverride || '').trim();
  const base = (aiContext || '').trim();
  const effective = override || base;
  if (!effective) return null;

  const hasOverride = !!override;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="View judging scope"
          title="Judging scope"
          className="p-2 rounded-lg text-muted-foreground/60 hover:text-primary active:text-primary transition-colors"
        >
          <Info className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[280px] p-3">
        <div className="flex items-start gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: hasOverride
                ? 'hsl(var(--da-gold-bright) / 0.15)'
                : 'hsl(var(--primary) / 0.12)',
            }}
          >
            <Sparkles
              className="w-3.5 h-3.5"
              style={{ color: hasOverride ? 'hsl(var(--da-gold-bright))' : 'hsl(var(--primary))' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {hasOverride ? 'Judging Scope (Override)' : 'Judging Scope'}
            </p>
            <p className="text-[12px] leading-snug mt-1 whitespace-pre-wrap break-words">
              {effective}
            </p>
            {hasOverride && (
              <p className="text-[10px] text-muted-foreground/60 mt-1.5 italic">
                Set by the commissioner.
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
