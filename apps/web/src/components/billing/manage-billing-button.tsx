'use client';
import { useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';

/** Opens the Stripe Billing Portal via the server (customer id never leaves it). */
export function ManageBillingButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const body = await res.json();
      if (body.success && body.data?.url) {
        window.location.href = body.data.url;
        return;
      }
      setError(body.error?.message ?? 'Could not open the billing portal.');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className={
          className ??
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-elevated disabled:opacity-60'
        }
      >
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <CreditCard size={15} aria-hidden />}
        Manage billing
      </button>
      {error && <span className="text-xs text-warning">{error}</span>}
    </span>
  );
}
