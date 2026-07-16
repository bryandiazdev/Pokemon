'use client';
import { createBrowserClient } from '@supabase/ssr';

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.local')
  );
}

/** Browser Supabase client. Returns null when Supabase is not configured. */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    // A loopback URL in a production browser build can't reach the user's
    // laptop Supabase either (and confuses sign-in). Treat as unconfigured.
    if (typeof window !== 'undefined') {
      const host = new URL(url).hostname;
      const pageHost = window.location.hostname;
      if (isLoopbackHost(host) && !isLoopbackHost(pageHost)) return null;
    }
  } catch {
    return null;
  }
  return createBrowserClient(url, anon);
}
