import 'server-only';
import { DEMO_USER } from '@psr/testing';
import { getServerSupabase } from './supabase/server';
import { hasSupabase } from './env';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  isDemo: boolean;
}

/**
 * Resolve the current user. In demo mode (no Supabase configured) we return the
 * seeded demo user so the whole app is explorable without sign-in. In live mode
 * this reads the authenticated Supabase session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!hasSupabase) {
    return {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      displayName: DEMO_USER.displayName,
      isDemo: true,
    };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: (user.user_metadata?.display_name as string) ?? user.email ?? 'Collector',
    isDemo: false,
  };
}

/** For protected routes: return the user or throw an auth sentinel. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
