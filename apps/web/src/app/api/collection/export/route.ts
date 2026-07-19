import { withErrorHandling, jsonPaywall } from '@/lib/api';
import { getPortfolioSummary } from '@/lib/services/portfolio';
import { getEntitlementContext, checkExport } from '@/lib/services/entitlements';
import { fmtMinor } from '@/lib/format';

/** CSV export of the collection (Collector+). Large exports would run as a background job. */
export const GET = withErrorHandling(async () => {
  const ctx = await getEntitlementContext();
  const gate = checkExport(ctx);
  if (!gate.allowed) return jsonPaywall(gate);
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
