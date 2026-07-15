import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <WifiOff className="text-muted" size={36} />
      <h1 className="text-xl font-semibold">You’re offline</h1>
      <p className="max-w-sm text-sm text-muted">
        Some features need a connection. Scans you queue while offline will sync automatically when
        you’re back online.
      </p>
      <Link href="/app" className="text-sm text-accent hover:underline">
        Try again
      </Link>
    </div>
  );
}
