import 'server-only';
import type { JobDeps, JobStore, Logger, Clock } from './types';
import { DemoJobStore } from './demo-store';
import { SupabaseJobStore } from './supabase-store';
import { createRegistryPricingSource } from './pricing-source';
import { getLock } from '../redis';
import { getAdminSupabase } from '../supabase/admin';
import { hasSupabase } from '../env';

const consoleLogger: Logger = {
  info(message, meta) {
    // eslint-disable-next-line no-console
    console.log(`[job] ${message}`, meta ?? '');
  },
  warn(message, meta) {
    // eslint-disable-next-line no-console
    console.warn(`[job] ${message}`, meta ?? '');
  },
};

const systemClock: Clock = { now: () => new Date() };

// Demo store is a process singleton so the daily-sync sequence shares state.
let demoStoreSingleton: DemoJobStore | null = null;

export function getJobStore(): JobStore {
  const admin = hasSupabase ? getAdminSupabase() : null;
  if (admin) return new SupabaseJobStore(admin);
  if (!demoStoreSingleton) demoStoreSingleton = new DemoJobStore();
  return demoStoreSingleton;
}

/** Assemble the production job dependencies. */
export function getJobDeps(overrides: Partial<JobDeps> = {}): JobDeps {
  return {
    store: overrides.store ?? getJobStore(),
    pricing: overrides.pricing ?? createRegistryPricingSource(),
    lock: overrides.lock ?? getLock(),
    clock: overrides.clock ?? systemClock,
    logger: overrides.logger ?? consoleLogger,
  };
}
