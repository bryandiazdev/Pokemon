import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { getCardsInSetPage, SET_CARDS_PAGE_SIZE } from '@/lib/services/catalog';

const querySchema = z.object({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL((req as NextRequest).url);
  // Path: /api/sets/<externalId>/cards
  const parts = url.pathname.split('/');
  const externalId = decodeURIComponent(parts[parts.length - 2] ?? '');
  if (!externalId) {
    return jsonError('validation_error', 'Set id is required.');
  }

  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return jsonError('validation_error', 'Invalid pagination parameters.', {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }

  const { cards, nextCursor } = await getCardsInSetPage(externalId, {
    cursor: parsed.data.cursor,
    limit: parsed.data.limit ?? SET_CARDS_PAGE_SIZE,
  });

  return jsonOk({ cards, nextCursor }, { count: cards.length });
});
