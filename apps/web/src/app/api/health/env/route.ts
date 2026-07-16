import { NextResponse } from 'next/server';
import { getEnvDiagnostics } from '@psr/config';
import { env, hasSupabase, hasStripe } from '@/lib/env';
import { getProviderStatus } from '@/lib/providers';

export const dynamic = 'force-dynamic';

/**
 * Deployment diagnostics: what configuration this instance actually resolved.
 *
 * SAFE BY CONSTRUCTION — exposes only:
 *  - resolved mode/selectors (non-secret),
 *  - booleans for whether integrations are configured,
 *  - the Supabase HOST (already public via NEXT_PUBLIC_*),
 *  - names of env fields that were sanitized/dropped — never their values.
 */
export async function GET() {
  const diag = getEnvDiagnostics();
  const status = getProviderStatus();

  let supabaseHost: string | null = null;
  try {
    supabaseHost = env.NEXT_PUBLIC_SUPABASE_URL ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).host : null;
  } catch {
    supabaseHost = 'invalid-url';
  }

  return NextResponse.json({
    ok: true,
    resolved: {
      dataMode: env.DATA_MODE,
      providerPreset: env.PROVIDER_PRESET,
      catalogProvider: status.catalogLive ? status.sourceName : 'demo',
      rawPricingLive: status.rawPricingLive,
      hasSupabase,
      supabaseHost,
      hasStripe,
    },
    envDiagnostics: {
      liveDowngraded: diag.liveDowngraded,
      supabaseLoopbackRejected: diag.supabaseLoopbackRejected,
      droppedKeys: diag.droppedKeys,
      warnings: diag.warnings,
    },
    hint: diag.supabaseLoopbackRejected
      ? 'NEXT_PUBLIC_SUPABASE_URL was a localhost address on this hosted deploy and was ignored. Set it to your https://YOUR_PROJECT.supabase.co URL in Vercel, then redeploy.'
      : !hasSupabase
        ? 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (and SUPABASE_SERVICE_ROLE_KEY) in Vercel for live auth/persistence.'
        : null,
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
  });
}
