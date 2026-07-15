import { defineConfig } from '@trigger.dev/sdk/v3';

/**
 * Trigger.dev v3 configuration. Tasks live in `src/trigger`. The project ref
 * comes from your Trigger.dev dashboard (set TRIGGER_PROJECT_REF). Jobs are
 * durable, retryable, and observable via the Trigger.dev dashboard; the actual
 * work is delegated to the fully-tested functions in `src/lib/jobs`.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_pokemonstockradar',
  dirs: ['./src/trigger'],
  maxDuration: 900, // 15 min ceiling per run
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 5_000,
      maxTimeoutInMs: 60_000,
      factor: 2,
      randomize: true,
    },
  },
});
