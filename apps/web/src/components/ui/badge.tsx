import * as React from 'react';
import { cn } from '@psr/ui';
import type { DataFreshness } from '@psr/types';
import { FRESHNESS_LABEL } from '@/lib/format';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'gold' | 'demo';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-elevated text-muted border-border',
    positive: 'bg-positive/15 text-positive border-positive/30',
    negative: 'bg-negative/15 text-negative border-negative/30',
    warning: 'bg-warning/15 text-warning border-warning/30',
    info: 'bg-info/15 text-info border-info/30',
    gold: 'bg-gold/15 text-gold border-gold/30',
    demo: 'bg-demo/15 text-demo border-demo/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Freshness badge — honestly labels where a datum came from. Uses BOTH color and
 * text (never color alone) for accessibility.
 */
export function FreshnessBadge({ freshness }: { freshness: DataFreshness }) {
  const tone =
    freshness === 'live'
      ? 'positive'
      : freshness === 'stale'
        ? 'warning'
        : freshness === 'demo'
          ? 'demo'
          : 'info';
  return (
    <Badge tone={tone} title={`Data source: ${FRESHNESS_LABEL[freshness]}`}>
      {FRESHNESS_LABEL[freshness]}
    </Badge>
  );
}
