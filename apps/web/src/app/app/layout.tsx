import { Sidebar } from '@/components/nav/sidebar';
import { BottomNav } from '@/components/nav/bottom-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentUser } from '@/lib/auth';
import { CommandSearch } from '@/components/command-search';
import Link from 'next/link';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur">
          <div className="flex-1">
            <CommandSearch />
          </div>
          <ThemeToggle />
          <Link
            href="/app/account"
            className="inline-flex h-9 items-center rounded-full bg-surface-elevated px-3 text-sm text-muted hover:text-content"
          >
            {user?.displayName ?? 'Account'}
          </Link>
        </header>
        <main id="main" className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
