import { describe, it, expect, beforeEach } from 'vitest';
import { loadEnv, __resetEnvCache } from './env';

describe('env validation', () => {
  beforeEach(() => __resetEnvCache());

  it('defaults to demo mode with no secrets', () => {
    const env = loadEnv({});
    expect(env.DATA_MODE).toBe('demo');
    expect(env.CATALOG_PROVIDER).toBe('demo');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('degrades live→demo (never throws) when Supabase is missing', () => {
    // Runtime resilience: a misconfigured DATA_MODE=live must not brick the app.
    const env = loadEnv({ DATA_MODE: 'live' });
    expect(env.DATA_MODE).toBe('demo');
  });

  it('accepts live mode when supabase is present', () => {
    const env = loadEnv({
      DATA_MODE: 'live',
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    expect(env.DATA_MODE).toBe('live');
  });
});
