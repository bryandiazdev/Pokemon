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

  it('requires supabase in live mode', () => {
    expect(() => loadEnv({ DATA_MODE: 'live' })).toThrow(/Supabase/i);
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
