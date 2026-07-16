import * as React from 'react';
import { cn } from '@psr/ui';
import type { DataFreshness } from '@psr/types';
import { FRESHNESS_LABEL } from '@/lib/format';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'gold' | 'demo' | 'accent';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-elevated text-muted border-border',
    accent: 'bg-accent/12 text-accent border-accent/30',
    positive: 'bg-positive/12 text-positive border-positive/30',
    negative: 'bg-negative/12 text-negative border-negative/30',
    warning: 'bg-warning/12 text-warning border-warning/30',
    info: 'bg-info/12 text-info border-info/30',
    gold: 'bg-gold/12 text-gold border-gold/30',
    demo: 'bg-demo/12 text-demo border-demo/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[0.68rem] tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Freshness badge — honestly labels where a datum came from. Uses BOTH color and
 * text (never color alone) for accessibility. A small dot reinforces status.
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
      <span
        aria-hidden
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          freshness === 'live' && 'bg-positive',
          freshness === 'stale' && 'bg-warning',
          freshness === 'demo' && 'bg-demo',
          (freshness === 'snapshot' || freshness === 'estimated') && 'bg-info',
        )}
      />
      {FRESHNESS_LABEL[freshness]}
    </Badge>
  );
}
