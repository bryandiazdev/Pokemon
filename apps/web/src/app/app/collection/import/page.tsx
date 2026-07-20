import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/card';
import { Upload } from 'lucide-react';

export const metadata = { title: 'Import CSV' };

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Import collection</h1>
        <p className="text-muted">Upload a CSV, map your columns, preview, then import.</p>
      </div>
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Upload size={18} className="text-accent" aria-hidden />
          <CardTitle>CSV import is coming soon</CardTitle>
        </div>
        <p className="text-sm text-muted">
          The import wizard — column mapping, per-row validation, duplicate detection, and
          rollback — is in development. Until it ships, you can add cards by{' '}
          <Link href="/app/scan" className="text-accent hover:underline">
            scanning them
          </Link>{' '}
          or{' '}
          <Link href="/app/collection/add" className="text-accent hover:underline">
            searching the catalog
          </Link>
          .
        </p>
        <Link
          href="/app/collection"
          className="inline-flex min-h-[42px] w-fit items-center rounded-lg border border-border px-4 text-sm hover:bg-surface-elevated"
        >
          Back to collection
        </Link>
      </Card>
    </div>
  );
}
