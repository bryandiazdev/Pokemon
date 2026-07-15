'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  async function upgrade() {
    setLoading(true);
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval: 'month' }),
    });
    const body = await res.json();
    setLoading(false);
    if (body.success && body.data.url) window.location.href = body.data.url;
  }
  return (
    <Button variant="gold" onClick={upgrade} disabled={loading}>
      {loading ? 'Redirecting…' : 'Upgrade to Collector Pro — $4.99/mo'}
    </Button>
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
