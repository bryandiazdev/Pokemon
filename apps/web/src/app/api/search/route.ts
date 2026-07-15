import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { searchCards } from '@/lib/services/catalog';

const querySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL((req as NextRequest).url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q'),
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return jsonError('validation_error', 'A search query is required.', {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }
  const cards = await searchCards(parsed.data.q, parsed.data.limit ?? 20);
  return jsonOk({ cards }, { count: cards.length });
});
