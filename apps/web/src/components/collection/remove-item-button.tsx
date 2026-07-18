'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

/**
 * Two-step remove control for a collection item: first tap arms it
 * ("Remove?"), second tap deletes. Arms auto-reset after a moment so a stray
 * tap can't linger. Errors (e.g. demo mode's sign-in requirement) surface
 * through onError so the parent can place the message.
 */
export function RemoveItemButton({
  itemId,
  label,
  onError,
  className,
}: {
  itemId: string;
  label?: string;
  onError?: (message: string) => void;
  className?: string;
}) {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const [error, setError] = useState('');
  const router = useRouter();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fail(message: string) {
    if (onError) onError(message);
    else setError(message);
    setPhase('idle');
  }

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function onClick() {
    if (phase === 'busy') return;
    setError('');
    if (phase === 'idle') {
      setPhase('confirm');
      resetTimer.current = setTimeout(() => setPhase('idle'), 4000);
      return;
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setPhase('busy');
    try {
      const res = await fetch(`/api/collection/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      const body = await res.json();
      if (!body.success) {
        fail(body.error?.message ?? 'Could not remove that card.');
        return;
      }
      router.refresh();
    } catch {
      fail('Network error — try again.');
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={phase === 'busy'}
        aria-label={label ? `Remove ${label}` : 'Remove from collection'}
        className={
          className ??
          `inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:opacity-50 ${
            phase === 'confirm'
              ? 'border-negative/50 bg-negative/10 text-negative'
              : 'border-border text-muted hover:border-negative/40 hover:text-negative'
          }`
        }
      >
        <Trash2 size={13} aria-hidden />
        {phase === 'busy' ? 'Removing…' : phase === 'confirm' ? 'Remove?' : 'Remove'}
      </button>
      {error && <span className="text-xs text-warning">{error}</span>}
    </span>
  );
}
