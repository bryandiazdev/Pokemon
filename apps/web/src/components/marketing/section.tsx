import type { ReactNode } from 'react';
import { cn } from '@psr/ui';

/** A vertically-spaced page section with an optional eyebrow, heading, and lead text. */
export function Section({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn('py-14 sm:py-16', className)}>{children}</section>;
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  as = 'h2',
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  as?: 'h1' | 'h2';
  className?: string;
}) {
  const Heading = as;
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && (
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent">{eyebrow}</p>
      )}
      <Heading
        className={cn(
          'font-semibold tracking-tight text-content',
          as === 'h1' ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl',
        )}
      >
        {title}
      </Heading>
      {lead && <p className="mt-4 text-lg leading-relaxed text-muted">{lead}</p>}
    </div>
  );
}

/** A simple prose wrapper for legal / long-form pages. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-3xl space-y-6 text-base leading-relaxed text-muted',
        '[&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-content',
        '[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-content',
        '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-strong',
        '[&_strong]:font-semibold [&_strong]:text-content',
        '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
