import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { listSets } from '@/lib/services/catalog';

const LANGUAGES = ['en', 'ja', 'zh-cn', 'zh-tw', 'es', 'fr', 'de', 'it', 'pt', 'ko'] as const;

const querySchema = z.object({
  lang: z.enum(LANGUAGES).optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL((req as NextRequest).url);
  const parsed = querySchema.safeParse({ lang: url.searchParams.get('lang') ?? undefined });
  if (!parsed.success) {
    return jsonError('validation_error', 'Unsupported catalog language.');
  }
  const sets = await listSets(parsed.data.lang);
  return jsonOk({ sets }, { count: sets.length, lang: parsed.data.lang ?? 'en' });
});
