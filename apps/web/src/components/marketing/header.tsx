'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Radar, Menu, X } from 'lucide-react';
import { cn } from '@psr/ui';
import { ThemeToggle } from '@/components/theme-toggle';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/sets', label: 'Sets' },
  { href: '/market', label: 'Market' },
  { href: '/methodology', label: 'Methodology' },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg text-content"
          aria-label="Pokémon Stock Radar home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Radar size={20} aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            Pokémon Stock Radar
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-content"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-content sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="hidden min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-strong sm:inline-flex"
          >
            Create account
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-elevated md:hidden"
          >
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-menu" className="border-t border-border bg-bg md:hidden">
          <nav aria-label="Mobile" className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-content',
                  'hover:bg-surface-elevated',
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-border" />
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-content hover:bg-surface-elevated"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-lg bg-accent px-3 text-sm font-semibold text-bg hover:bg-accent-strong"
            >
              Create account
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
