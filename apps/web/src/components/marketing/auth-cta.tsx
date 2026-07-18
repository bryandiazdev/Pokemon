'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/client';

type AuthState = 'unknown' | 'in' | 'out';

/**
 * Session-aware CTAs for the marketing header. A signed-in user must never be
 * shown "Sign in" — that reads as being logged out and sends people through
 * auth again for nothing. Resolved client-side so marketing pages stay static.
 */
export function AuthCta({
  variant,
  onNavigate,
}: {
  variant: 'desktop' | 'mobile';
  onNavigate?: () => void;
}) {
  const [state, setState] = useState<AuthState>('unknown');

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setState('out'); // demo mode — no accounts
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setState(data.session ? 'in' : 'out');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? 'in' : 'out');
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Reserve layout space while resolving, so the header doesn't jump — and
  // never flash "Sign in" at a signed-in user.
  if (state === 'unknown') {
    return variant === 'desktop' ? (
      <span className="hidden h-10 w-40 sm:inline-flex" aria-hidden />
    ) : (
      <span className="block min-h-11" aria-hidden />
    );
  }

  if (state === 'in') {
    return variant === 'desktop' ? (
      <Link
        href="/app"
        className="hidden min-h-10 items-center gap-2 rounded-lg bg-prism px-4 text-sm font-semibold text-accent-ink transition-all hover:brightness-110 sm:inline-flex"
      >
        <LayoutDashboard size={15} aria-hidden /> Open app
      </Link>
    ) : (
      <Link
        href="/app"
        onClick={onNavigate}
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-prism px-3 text-sm font-semibold text-accent-ink"
      >
        <LayoutDashboard size={15} aria-hidden /> Open app
      </Link>
    );
  }

  return variant === 'desktop' ? (
    <>
      <Link
        href="/sign-in"
        className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-content sm:inline-flex"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className="hidden min-h-10 items-center rounded-lg bg-prism px-4 text-sm font-semibold text-accent-ink transition-all hover:brightness-110 sm:inline-flex"
      >
        Create account
      </Link>
    </>
  ) : (
    <>
      <Link
        href="/sign-in"
        onClick={onNavigate}
        className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-content hover:bg-surface-elevated"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        onClick={onNavigate}
        className="flex min-h-11 items-center justify-center rounded-lg bg-prism px-3 text-sm font-semibold text-accent-ink"
      >
        Create account
      </Link>
    </>
  );
}
