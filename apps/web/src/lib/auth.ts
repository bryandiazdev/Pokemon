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

/** Cap how long we wait on Supabase auth so a hung project can't 500 the page. */
const AUTH_TIMEOUT_MS = 2_500;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
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
  try {
    const supabase = await getServerSupabase();
    if (!supabase) return null;
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS, 'supabase.auth.getUser');
    if (!user) return null;
    return {
      id: user.id,
      email: user.email ?? '',
      displayName: (user.user_metadata?.display_name as string) ?? user.email ?? 'Collector',
      isDemo: false,
    };
  } catch (err) {
    // A transient Supabase/auth failure must never 500 a page — treat as logged out.
    // eslint-disable-next-line no-console
    console.error('[auth] getCurrentUser failed; treating as unauthenticated:', err);
    return null;
  }
}

/** For protected routes: return the user or throw an auth sentinel. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
