import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { getRawHistory } from '@/lib/services/catalog';
import { getEntitlementContext } from '@/lib/services/entitlements';
import { resolveLimit } from '@psr/config';

const rangeToDays: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: 730,
};

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  // Path: /api/cards/<externalId>/history
  const parts = url.pathname.split('/');
  const externalId = decodeURIComponent(parts[parts.length - 2] ?? '');
  const range = z
    .enum(['7d', '30d', '90d', '1y', 'all'])
    .catch('90d')
    .parse(url.searchParams.get('range') ?? '90d');
  if (!externalId) return jsonError('validation_error', 'Missing card id.');

  // History depth is an entitlement: Free sees the recent window (30d),
  // Collector/Pro see everything. The response says when it was clamped so
  // the chart can render an upgrade hint instead of silently truncating.
  const ctx = await getEntitlementContext();
  const { unlimited, value: maxDays } = resolveLimit(ctx.entitlements.historyDays);
  const requestedDays = rangeToDays[range]!;
  const days = unlimited ? requestedDays : Math.min(requestedDays, maxDays);

  const points = await getRawHistory(externalId, days);
  return jsonOk(
    { points, range, clamped: days < requestedDays, historyDays: unlimited ? null : maxDays },
    { freshness: 'demo' },
  );
});
