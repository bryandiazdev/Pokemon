import { cn } from '@psr/ui';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

/**
 * Stat tile styled like a graded-slab label: a mono uppercase caption strip, a
 * large editorial value, and a signed delta. The optional accent bar tints the
 * left edge (era/category color).
 */
export function Stat({
  label,
  value,
  sub,
  delta,
  accent,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  accent?: string;
  className?: string;
}) {
  const tone =
    delta == null ? 'neutral' : delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
  return (
    <div className={cn('card-surface hairline-top relative overflow-hidden p-4', className)}>
      {accent && (
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-0.5 rounded-full"
          style={{ background: accent }}
        />
      )}
      <div className="label-strip">{label}</div>
      {/* clamp(): scale the value down on narrow half-width tiles so five-figure
          portfolios render whole instead of clipping at the tile edge. */}
      <div className="mt-2 font-display text-[clamp(1.05rem,5.5vw,1.7rem)] font-semibold leading-none tabular text-content">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta != null && tone !== 'neutral' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-mono font-medium',
              tone === 'positive' ? 'text-positive' : 'text-negative',
            )}
          >
            {tone === 'positive' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-muted">{sub}</span>}
      </div>
    </div>
  );
}
