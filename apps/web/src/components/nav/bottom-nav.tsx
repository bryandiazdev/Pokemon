'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@psr/ui';
import { NAV_ITEMS } from './nav-items';

export function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => i.mobile);
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur md:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
              active ? 'text-accent' : 'text-muted',
            )}
          >
            <Icon size={20} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
