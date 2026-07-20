'use client';
import { useEffect, useRef, useState } from 'react';
import { Share2, Copy, Check, X } from 'lucide-react';

/**
 * Share-link control for the collection page. Sharing creates a read-only
 * public link (unlisted — only people with the link can see it); turning it
 * off permanently invalidates the link.
 */
export function ShareCollection() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/collection/share');
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? 'Could not load sharing state.');
        return;
      }
      setEnabled(body.data.enabled);
      setUrl(body.data.url);
    } catch {
      setError('Network error — try again.');
    } finally {
      setLoading(false);
    }
  }

  async function toggle(next: boolean) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/collection/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? 'Could not update sharing.');
        return;
      }
      setEnabled(body.data.enabled);
      setUrl(body.data.url);
      setCopied(false);
    } catch {
      setError('Network error — try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy — long-press the link to copy it manually.');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-surface-elevated"
      >
        <Share2 size={16} aria-hidden /> Share
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-bg-deep/40 p-4 sm:max-w-md">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Share2 size={15} className="text-accent" aria-hidden /> Share your collection
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close sharing panel"
          className="rounded p-1 text-muted hover:text-content"
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">
        Anyone with the link sees a read-only view of your cards — no prices you paid, no account
        details. Turning sharing off permanently disables the link.
      </p>

      {error && <p className="mt-2 text-xs text-warning">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => toggle(!enabled)}
          className={`inline-flex min-h-[38px] items-center rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
            enabled
              ? 'border border-border text-muted hover:border-negative/40 hover:text-negative'
              : 'bg-accent text-bg hover:bg-accent-strong'
          }`}
        >
          {loading ? 'Working…' : enabled ? 'Turn sharing off' : 'Create share link'}
        </button>

        {enabled && url && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-[38px] max-w-full items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 text-xs text-accent"
          >
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            <span className="truncate font-mono">{copied ? 'Copied!' : url}</span>
          </button>
        )}
      </div>
    </div>
  );
}
