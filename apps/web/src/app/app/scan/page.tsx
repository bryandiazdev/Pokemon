import { ScanClient } from './scan-client';

export const metadata = { title: 'Scan a card' };

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Quick scan</h1>
        <p className="text-muted">Identify a card and add it to your collection in seconds.</p>
      </div>
      <ScanClient />
    </div>
  );
}
