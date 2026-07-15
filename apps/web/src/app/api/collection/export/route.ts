import { withErrorHandling } from '@/lib/api';
import { getPortfolioSummary } from '@/lib/services/portfolio';
import { fmtMinor } from '@/lib/format';

/** CSV export of the collection. Large exports would run as a background job. */
export const GET = withErrorHandling(async () => {
  const summary = await getPortfolioSummary();
  const header = [
    'card',
    'type',
    'grade_label',
    'quantity',
    'cost_basis',
    'current_value',
    'gain_loss',
  ];
  const rows = summary.items.map((i) =>
    [
      escapeCsv(i.name),
      i.ownershipType,
      escapeCsv(i.gradeLabel ?? ''),
      String(i.quantity),
      fmtMinor(i.costBasis.minor, summary.currency),
      fmtMinor(i.lineValue.minor, summary.currency),
      fmtMinor(i.gain.minor, summary.currency),
    ].join(','),
  );
  const csv = [header.join(','), ...rows].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="pokemon-stock-radar-collection.csv"',
    },
  });
});

function escapeCsv(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
