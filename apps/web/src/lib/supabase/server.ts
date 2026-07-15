import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env, hasSupabase } from '../env';

/**
 * Server Supabase client bound to the request cookies. Returns null when no
 * Supabase project is configured (demo mode), so callers can degrade gracefully.
 */
export async function getServerSupabase() {
  if (!hasSupabase) return null;
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of items) {
              cookieStore.set(name, value, options as never);
            }
          } catch {
            // In RSC render, cookie writes are ignored (handled in middleware).
          }
        },
      },
    },
  );
}
