import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { getRawHistory } from '@/lib/services/catalog';

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
  const points = await getRawHistory(externalId, rangeToDays[range]!);
  return jsonOk({ points, range }, { freshness: 'demo' });
});
