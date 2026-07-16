'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@psr/ui';
import { NAV_ITEMS } from './nav-items';
import { Wordmark } from '@/components/brand';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-[236px] md:flex-col md:border-r md:border-border md:bg-surface/60">
      <div className="flex h-16 items-center px-5">
        <Link href="/app" className="transition-opacity hover:opacity-80">
          <Wordmark markSize={26} />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-3" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-surface-elevated text-content'
                  : 'text-muted hover:bg-surface-elevated/60 hover:text-content',
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-prism"
                />
              )}
              <Icon
                size={18}
                aria-hidden
                className={active ? 'text-accent' : 'text-faint group-hover:text-muted'}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <Link href="/methodology" className="label-strip transition-colors hover:text-muted">
          Grade methodology
        </Link>
      </div>
    </aside>
  );
}
