import { resolveLimit } from '@psr/config';

/**
 * Accessible usage meter: "18 of 25 used" with a progress bar. A null/-1
 * limit renders as Unlimited; a 0 limit renders the upgrade hint instead of
 * an empty bar.
 */
export function UsageMeter({
  label,
  used,
  limit,
  zeroLimitHint,
}: {
  label: string;
  used: number;
  limit: number;
  zeroLimitHint?: string;
}) {
  const { unlimited, value } = resolveLimit(limit);

  if (!unlimited && value === 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-content">{label}</span>
          <span className="text-xs text-muted">{zeroLimitHint ?? 'Not on your plan'}</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-deep" aria-hidden />
      </div>
    );
  }

  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, value)) * 100));
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-content">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted">
          {unlimited ? `${used} used · Unlimited` : `${used} of ${value} used`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : value}
        aria-valuetext={unlimited ? `${used} used, unlimited` : `${used} of ${value} used`}
        className="h-1.5 overflow-hidden rounded-full bg-bg-deep"
      >
        <div
          className={`h-full rounded-full transition-all ${nearLimit ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: unlimited ? '4%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}
