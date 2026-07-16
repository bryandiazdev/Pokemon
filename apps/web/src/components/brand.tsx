import { cn } from '@psr/ui';

/**
 * Original "radar" brand mark — concentric rings + a holographic sweep wedge.
 * Not derived from any Pokémon or grading-company asset.
 */
export function RadarMark({
  size = 28,
  className,
  sweep = true,
}: {
  size?: number;
  className?: string;
  sweep?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="psr-prism" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="rgb(var(--prism-1))" />
          <stop offset="0.45" stopColor="rgb(var(--prism-2))" />
          <stop offset="0.75" stopColor="rgb(var(--prism-3))" />
          <stop offset="1" stopColor="rgb(var(--prism-4))" />
        </linearGradient>
        <radialGradient id="psr-sweep" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgb(var(--prism-1))" stopOpacity="0.9" />
          <stop offset="1" stopColor="rgb(var(--prism-1))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" stroke="url(#psr-prism)" strokeWidth="1.6" opacity="0.9" />
      <circle cx="16" cy="16" r="9.5" stroke="rgb(var(--border-strong))" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="4.5" stroke="rgb(var(--border-strong))" strokeWidth="1.2" />
      {sweep && (
        <g className="radar-sweep">
          <path d="M16 16 L16 1.5 A14.5 14.5 0 0 1 30 13 Z" fill="url(#psr-sweep)" opacity="0.55" />
        </g>
      )}
      <circle cx="16" cy="16" r="2.1" fill="url(#psr-prism)" />
    </svg>
  );
}

export function Wordmark({
  className,
  markSize = 26,
  sweep = true,
}: {
  className?: string;
  markSize?: number;
  sweep?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <RadarMark size={markSize} sweep={sweep} />
      <span className="font-display text-[1.05rem] font-semibold tracking-tight text-content">
        Stock<span className="text-prism"> Radar</span>
      </span>
    </span>
  );
}
