import { describe, it, expect, beforeEach } from 'vitest';
import { loadEnv, getEnvDiagnostics, __resetEnvCache } from './env';

describe('env validation', () => {
  beforeEach(() => __resetEnvCache());

  it('defaults to demo mode with no secrets', () => {
    const env = loadEnv({});
    expect(env.DATA_MODE).toBe('demo');
    expect(env.CATALOG_PROVIDER).toBe('demo');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('degrades live→demo (never throws) when Supabase is missing', () => {
    const env = loadEnv({ DATA_MODE: 'live' });
    expect(env.DATA_MODE).toBe('demo');
    expect(getEnvDiagnostics().liveDowngraded).toBe(true);
  });

  it('accepts live mode when supabase is present', () => {
    const env = loadEnv({
      DATA_MODE: 'live',
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    expect(env.DATA_MODE).toBe('live');
  });

  // --- The dashboard-mangled-values matrix. None of these may throw. ---

  it('survives trailing whitespace and surrounding quotes', () => {
    const env = loadEnv({
      DATA_MODE: ' live ',
      NEXT_PUBLIC_SUPABASE_URL: '"https://x.supabase.co"',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: " 'anon-key' ",
      PROVIDER_PRESET: 'tcgdex ',
    });
    expect(env.DATA_MODE).toBe('live');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://x.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('anon-key');
    expect(env.PROVIDER_PRESET).toBe('tcgdex');
  });

  it('adds https:// to bare-host URLs', () => {
    const env = loadEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'xyz.supabase.co',
      NEXT_PUBLIC_APP_URL: 'pokemon-web.vercel.app',
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://xyz.supabase.co');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('https://pokemon-web.vercel.app');
  });

  it('case-folds enum values', () => {
    const env = loadEnv({ DATA_MODE: 'Live', PROVIDER_PRESET: 'TCGDEX', NEXT_PUBLIC_SUPABASE_URL: 'https://x.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' });
    expect(env.DATA_MODE).toBe('live');
    expect(env.PROVIDER_PRESET).toBe('tcgdex');
  });

  it('drops genuinely invalid values to defaults instead of throwing', () => {
    const env = loadEnv({
      DATA_MODE: 'production', // not a valid enum value even after folding
      NEXT_PUBLIC_APP_URL: 'not a url at all!!',
      PROVIDER_PRESET: 'tcgdex',
    });
    expect(env.DATA_MODE).toBe('demo'); // dropped to default
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000'); // dropped to default
    expect(env.PROVIDER_PRESET).toBe('tcgdex'); // valid fields survive
    const diag = getEnvDiagnostics();
    expect(diag.droppedKeys).toContain('DATA_MODE');
    expect(diag.droppedKeys).toContain('NEXT_PUBLIC_APP_URL');
  });

  it('treats empty strings as unset', () => {
    const env = loadEnv({ NEXT_PUBLIC_SUPABASE_URL: '', RESEND_FROM_EMAIL: '' });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.RESEND_FROM_EMAIL).toBeUndefined();
  });

  it('never throws on total garbage', () => {
    const env = loadEnv({
      DATA_MODE: '🔥🔥🔥',
      NEXT_PUBLIC_APP_URL: '::::',
      NEXT_PUBLIC_SUPABASE_URL: 'ht!tp://br oken',
      CATALOG_PROVIDER: 'amazon',
      NODE_ENV: 'staging',
    });
    expect(env.DATA_MODE).toBe('demo');
    expect(env.CATALOG_PROVIDER).toBe('demo');
  });

  it('rejects localhost Supabase URLs on Vercel (hosted) so auth cannot hang', () => {
    const env = loadEnv({
      VERCEL: '1',
      DATA_MODE: 'live',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.DATA_MODE).toBe('demo');
    const diag = getEnvDiagnostics();
    expect(diag.supabaseLoopbackRejected).toBe(true);
    expect(diag.liveDowngraded).toBe(true);
  });

  it('still allows localhost Supabase when not on a hosted runtime', () => {
    const env = loadEnv({
      DATA_MODE: 'live',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    expect(env.DATA_MODE).toBe('live');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(getEnvDiagnostics().supabaseLoopbackRejected).toBe(false);
  });
});
