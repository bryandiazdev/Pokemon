'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Radar } from 'lucide-react';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = getBrowserSupabase();
  const isSignUp = mode === 'sign-up';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (!supabase) {
      // Demo mode: no auth backend. Proceed into the app as the demo user.
      router.push('/app');
      return;
    }
    setLoading(true);
    const fn = isSignUp
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });
    const { error } = await fn;
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (isSignUp) setMessage('Check your email to verify your account.');
    else router.push('/app');
  }

  async function magicLink() {
    if (!supabase) return router.push('/app');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    setMessage(error ? error.message : 'Magic link sent — check your email.');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Link href="/" className="mb-6 flex items-center gap-2 text-accent">
        <Radar size={22} />
        <span className="font-semibold text-content">Pokémon Stock Radar</span>
      </Link>
      <h1 className="text-2xl font-semibold">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-1 text-sm text-muted">
        {isSignUp ? 'Start tracking your collection.' : 'Sign in to your collection.'}
      </p>

      {!supabase && (
        <p className="mt-4 rounded-lg border border-demo/30 bg-demo/10 px-3 py-2 text-xs text-demo">
          Demo mode — authentication is not configured, so this continues to the demo workspace.
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="psr-input"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Password</span>
          <input
            type="password"
            required={!!supabase}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="psr-input"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
        </label>
        {message && <p className="text-xs text-warning">{message}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <button
        type="button"
        onClick={magicLink}
        className="mt-3 w-full text-center text-sm text-accent hover:underline"
      >
        Email me a magic link
      </button>

      <p className="mt-6 text-center text-sm text-muted">
        {isSignUp ? (
          <>
            Already have an account?{' '}
            <Link href="/sign-in" className="text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/sign-up" className="text-accent hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
      {isSignUp && (
        <p className="mt-4 text-center text-xs text-muted">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </div>
  );
}
