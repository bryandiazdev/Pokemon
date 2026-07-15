import 'server-only';
import { loadEnv } from '@psr/config';

/** Server-side validated environment. Throws at boot if invalid. */
export const env = loadEnv(process.env);

export const isDemo = env.DATA_MODE === 'demo';

/** Whether a real Supabase project is configured. */
export const hasSupabase = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Whether real Stripe billing is configured. */
export const hasStripe = Boolean(env.STRIPE_SECRET_KEY);
