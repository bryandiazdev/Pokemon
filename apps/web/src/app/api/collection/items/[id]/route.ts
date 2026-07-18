import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { deleteCollectionItem } from '@/lib/services/collection';

export const DELETE = withErrorHandling(async (req: Request) => {
  // Must be a real, signed-in user (not the demo workspace) to modify data.
  // Checked first so demo users get sign-in guidance, not an id error.
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to manage your collection.');
  }

  // Path: /api/collection/items/<id>
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const id = decodeURIComponent(parts[parts.length - 1] ?? '');
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('validation_error', 'Invalid collection item id.');
  }

  await deleteCollectionItem(user.id, id);
  return jsonOk({ deleted: true });
});
