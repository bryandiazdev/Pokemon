import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated text-muted">
        <Icon size={22} />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg hover:bg-accent-strong"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
