'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Watch/unwatch toggle for a card detail page. Optimistic flip with rollback:
 * the server remains authoritative via router.refresh() after a success.
 */
export function WatchButton({
  cardExternalId,
  signedIn,
  initialWatched,
}: {
  cardExternalId: string;
  signedIn: boolean;
  initialWatched: boolean;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push('/sign-in');
      return;
    }
    const next = !watched;
    setWatched(next);
    setBusy(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardExternalId, watched: next }),
      });
      const body = await res.json();
      if (!body.success) {
        setWatched(!next);
        return;
      }
      router.refresh();
    } catch {
      setWatched(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={watched}
      aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      title={watched ? 'Watching — click to remove' : 'Add to watchlist'}
      className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-3 text-sm transition-colors disabled:opacity-60 ${
        watched
          ? 'border-accent/50 bg-accent/10 text-accent hover:border-accent'
          : 'border-border hover:border-border-strong hover:bg-surface-elevated'
      }`}
    >
      {watched ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
      {watched ? 'Watching' : 'Watch'}
    </button>
  );
}
