import { cn } from '@psr/ui';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export function Stat({
  label,
  value,
  sub,
  delta,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  className?: string;
}) {
  const tone = delta == null ? 'neutral' : delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
  return (
    <div className={cn('rounded-xl border border-border bg-surface p-4', className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-content">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta != null && tone !== 'neutral' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
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
