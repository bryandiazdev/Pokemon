import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { removeFromWatchlist } from '@/lib/services/watchlist';

export const DELETE = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to manage your watchlist.');
  }

  // Path: /api/watchlist/<id>
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const id = decodeURIComponent(parts[parts.length - 1] ?? '');
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('validation_error', 'Invalid watchlist item id.');
  }

  await removeFromWatchlist(user.id, id);
  return jsonOk({ deleted: true });
});
