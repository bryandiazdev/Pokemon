'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Boundary for errors thrown inside a route (below the root layout). Renders
 * within the app chrome so navigation stays available.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real message in Vercel/runtime logs (digest alone is opaque).
    // eslint-disable-next-line no-console
    console.error('[error-boundary]', error.digest ?? 'no-digest', error.message, error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-negative">
        !
      </div>
      <h1 className="font-display text-xl font-semibold">This page hit an error</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong loading this view. You can retry, or head back to your dashboard.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted/70">Ref: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <button
          onClick={reset}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink"
        >
          Try again
        </button>
        <Link
          href="/app"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-sm text-content hover:border-border-strong"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
