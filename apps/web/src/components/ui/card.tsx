import * as React from 'react';
import { cn } from '@psr/ui';

export function Card({
  className,
  slab = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { slab?: boolean }) {
  return (
    <div
      className={cn(
        slab ? 'slab hairline-top p-5' : 'card-surface hairline-top p-5',
        'transition-colors',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-2', className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('label-strip !text-[0.7rem] text-muted', className)}
      {...props}
    />
  );
}
