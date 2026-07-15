'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@psr/ui';
import { NAV_ITEMS } from './nav-items';
import { Radar } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-surface">
      <div className="flex h-16 items-center gap-2 px-5">
        <Radar className="text-accent" size={22} aria-hidden />
        <span className="font-semibold tracking-tight">Stock Radar</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted hover:bg-surface-elevated hover:text-content',
              )}
            >
              <Icon size={18} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 text-xs text-muted">
        <Link href="/methodology" className="hover:text-content">
          Grade methodology
        </Link>
      </div>
    </aside>
  );
}
