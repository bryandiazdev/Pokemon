'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function upgrade() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'collector', interval: 'month' }),
      });
      const body = await res.json();
      if (body.success && body.data.url) {
        window.location.href = body.data.url;
        return;
      }
      setError(body.error?.message ?? 'Could not start checkout.');
    } catch {
      setError('Network error — try again.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="gold" onClick={upgrade} disabled={loading}>
        {loading ? 'Redirecting…' : 'Upgrade to Collector — $7.99/mo'}
      </Button>
      {error && <span className="text-xs text-warning">{error}</span>}
    </span>
  );
}

export function DataControls() {
  const [status, setStatus] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/collection/export"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-sm hover:bg-surface-elevated"
        >
          Export my data
        </a>
        <Button
          variant="danger"
          onClick={() => setStatus('Account deletion requires confirmation via email in production. In demo mode this is a no-op.')}
        >
          Delete account
        </Button>
      </div>
      {status && <p className="text-xs text-muted">{status}</p>}
    </div>
  );
}
