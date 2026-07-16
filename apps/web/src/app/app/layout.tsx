import { Sidebar } from '@/components/nav/sidebar';
import { BottomNav } from '@/components/nav/bottom-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentUser } from '@/lib/auth';
import { CommandSearch } from '@/components/command-search';
import { RadarMark } from '@/components/brand';
import Link from 'next/link';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const initial = (user?.displayName ?? user?.email ?? 'A').charAt(0).toUpperCase();
  return (
    <div className="relative flex min-h-screen bg-bg">
      {/* Ambient depth: a soft top glow + film grain, so surfaces don't read flat. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(80% 50% at 50% -10%, rgb(var(--prism-2) / 0.06), transparent 70%)',
        }}
      />
      <div aria-hidden className="grain pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 flex w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-xl md:px-6">
            <Link href="/app" className="md:hidden" aria-label="Home">
              <RadarMark size={26} />
            </Link>
            <div className="flex-1">
              <CommandSearch />
            </div>
            <ThemeToggle />
            <Link
              href="/app/account"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm text-muted transition-colors hover:border-border-strong hover:text-content"
              title={user?.email ?? 'Account'}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-prism font-mono text-xs font-bold text-accent-ink">
                {initial}
              </span>
              <span className="hidden max-w-[140px] truncate sm:block">
                {user?.displayName ?? 'Account'}
              </span>
            </Link>
          </header>
          <main id="main" className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
            {children}
          </main>
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
