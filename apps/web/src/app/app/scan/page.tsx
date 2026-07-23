import Link from 'next/link';
import { Layers } from 'lucide-react';
import { ScanClient } from './scan-client';

export const metadata = { title: 'Scan a card' };

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Quick scan</h1>
          <p className="text-muted">Identify a card and add it to your collection in seconds.</p>
        </div>
        <Link
          href="/app/scan/batch"
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:border-border-strong hover:bg-surface-elevated"
        >
          <Layers size={14} aria-hidden /> Batch scan
          <span className="rounded bg-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-gold">
            PRO
          </span>
        </Link>
      </div>
      <ScanClient />
    </div>
  );
}
