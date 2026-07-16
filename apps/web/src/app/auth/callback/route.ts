import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Auth callback: exchanges the `code` from an email verification link, magic
 * link, or OAuth redirect for a durable session cookie, then forwards the user
 * into the app. The signup DB trigger has already provisioned their profile,
 * entitlements, and default collection by this point.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/app';

  if (code) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, url.origin));
      }
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
  }
  return NextResponse.redirect(new URL('/sign-in', url.origin));
}
