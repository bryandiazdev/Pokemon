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
        <CardTitle>1. Upload your file</CardTitle>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-elevated p-8 text-center text-sm text-muted">
          <Upload size={22} />
          <span>Drop a CSV here or click to browse</span>
          <input type="file" accept=".csv" className="hidden" />
        </label>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted">
          <li>Map columns (card, set, number, quantity, condition, grade, purchase price…).</li>
          <li>Preview with per-row validation and duplicate detection.</li>
          <li>Import — large files run as a background job with a downloadable error report.</li>
        </ol>
        <p className="text-xs text-muted">
          The import wizard supports partial imports and rollback. This is a preview in demo mode.
        </p>
      </Card>
    </div>
  );
}
