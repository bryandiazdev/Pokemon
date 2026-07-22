'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

/** Removes one watchlist row, then refreshes the server-rendered list. */
export function RemoveWatchButton({ itemId, label }: { itemId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      const body = await res.json();
      if (body.success) router.refresh();
    } catch {
      // Leave the row; the user can retry.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void remove()}
      disabled={busy}
      aria-label={`Stop watching ${label}`}
      title="Stop watching"
      className="rounded p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-negative disabled:opacity-50"
    >
      <X size={15} aria-hidden />
    </button>
  );
}
