import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { searchCards, searchSets } from '@/lib/services/catalog';

const querySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  /** Comma-separated: "cards", "sets", or both (default). */
  types: z.string().optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL((req as NextRequest).url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q'),
    limit: url.searchParams.get('limit') ?? undefined,
    types: url.searchParams.get('types') ?? undefined,
  });
  if (!parsed.success) {
    return jsonError('validation_error', 'A search query is required.', {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }

  const limit = parsed.data.limit ?? 20;
  const types = new Set(
    (parsed.data.types ?? 'cards,sets')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
  const wantCards = types.has('cards');
  const wantSets = types.has('sets');

  const [cards, sets] = await Promise.all([
    wantCards ? searchCards(parsed.data.q, limit) : Promise.resolve([]),
    wantSets ? searchSets(parsed.data.q, Math.min(limit, 12)) : Promise.resolve([]),
  ]);

  return jsonOk(
    { cards, sets },
    { count: cards.length + sets.length },
  );
});
