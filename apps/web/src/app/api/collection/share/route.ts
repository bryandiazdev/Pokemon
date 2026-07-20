import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { getShareState, setShareEnabled } from '@/lib/services/collection';
import { env } from '@/lib/env';

const bodySchema = z.object({ enabled: z.boolean() });

function shareUrl(slug: string | null): string | null {
  return slug ? `${env.NEXT_PUBLIC_APP_URL}/shared/${slug}` : null;
}

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to share your collection.');
  }
  const state = await getShareState(user.id);
  return jsonOk({ enabled: state.enabled, url: shareUrl(state.slug) });
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to share your collection.');
  }
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const state = await setShareEnabled(user.id, parsed.value.enabled);
  return jsonOk({ enabled: state.enabled, url: shareUrl(state.slug) });
});
