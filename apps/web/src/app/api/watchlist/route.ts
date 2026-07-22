import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { addToWatchlist, listWatchlist, unwatchCard } from '@/lib/services/watchlist';

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to use your watchlist.');
  }
  return jsonOk({ items: await listWatchlist(user.id) });
});

const bodySchema = z.object({
  cardExternalId: z.string().min(1).max(64),
  // true = watch, false = unwatch (card-page toggle sends its desired state).
  watched: z.boolean(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to use your watchlist.');
  }
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const { cardExternalId, watched } = parsed.value;
  if (watched) {
    await addToWatchlist(user.id, cardExternalId);
  } else {
    await unwatchCard(user.id, cardExternalId);
  }
  return jsonOk({ watched });
});
