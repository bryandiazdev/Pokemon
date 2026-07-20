'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';

/**
 * CSV export with real response handling. A plain <a href> navigation dumps
 * the JSON paywall/error body into the browser tab — this fetches instead,
 * downloads the CSV blob on success, and shows structured denials inline.
 */
export function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; upgrade: boolean } | null>(null);

  async function run() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/collection/export');
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('text/csv')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pokemon-stock-radar-collection.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
      const body = await res.json().catch(() => null);
      setNotice({
        message: body?.error?.message ?? 'Export failed. Try again.',
        upgrade: res.status === 402,
      });
    } catch {
      setNotice({ message: 'Network error — try again.', upgrade: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-surface-elevated disabled:opacity-50"
      >
        <Download size={16} aria-hidden /> {busy ? 'Exporting…' : 'Export'}
      </button>
      {notice && (
        <span className="max-w-[16rem] text-xs text-warning">
          {notice.message}{' '}
          {notice.upgrade && (
            <Link href="/pricing" className="text-accent underline-offset-2 hover:underline">
              See plans
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
