import { cn } from '@psr/ui';
import { RadarMark } from '@/components/brand';

/**
 * The signature "slab" — a card shown as if encased in a grading holder, with a
 * mono label strip (set · number · grade/condition). An ORIGINAL treatment: it
 * evokes PSA/BGS/CGC holders without copying any company's label. Premium cards
 * get a restrained holographic sheen on hover (foil-in-the-art-window principle).
 */
export function Slab({
  imageUrl,
  name,
  setName,
  number,
  gradeLabel,
  value,
  freshnessNote,
  premium = false,
  className,
}: {
  imageUrl?: string | null;
  name: string;
  setName?: string | null;
  number?: string | null;
  gradeLabel?: string | null;
  value?: string | null;
  freshnessNote?: string;
  premium?: boolean;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        'slab hairline-top group relative flex flex-col overflow-hidden p-2.5',
        premium && 'holo',
        className,
      )}
    >
      {/* Label strip — the "grading label". */}
      <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-border bg-bg-deep/60 px-2.5 py-1.5">
        <span className="min-w-0">
          <span className="block truncate font-display text-[0.8rem] font-semibold text-content">
            {name}
          </span>
          <span className="label-strip block truncate">
            {[setName, number ? `#${number}` : null].filter(Boolean).join(' · ') || 'Pokémon TCG'}
          </span>
        </span>
        <RadarMark size={18} sweep={false} className="shrink-0 opacity-70" />
      </div>

      {/* Encased card window. */}
      <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-md border border-border-strong bg-gradient-to-b from-surface-elevated to-bg-deep">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <RadarMark size={44} className="opacity-20" sweep={false} />
          </div>
        )}
        {premium && <span className="holo-sheen" />}
      </div>

      {/* Bottom rail — grade + value. */}
      {(gradeLabel || value) && (
        <figcaption className="mt-2 flex items-center justify-between gap-2">
          {gradeLabel ? (
            <span className="rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 font-mono text-[0.66rem] uppercase tracking-wide text-gold">
              {gradeLabel}
            </span>
          ) : (
            <span />
          )}
          {value && (
            <span className="font-mono text-sm font-medium tabular text-content" title={freshnessNote}>
              {value}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
