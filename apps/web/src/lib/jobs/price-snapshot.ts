import type { JobDeps, PricePointWrite } from './types';

/**
 * Daily price-snapshot job.
 *
 * Idempotent (the daily unique key on `price_points` dedupes re-runs),
 * concurrency-controlled (distributed lock), and rate-limit aware (batched with
 * a delay between batches). Prioritizes cards owned/watched by users so paid
 * users' data is freshest; it does NOT refresh the entire global catalog daily.
 */

export interface PriceSnapshotOptions {
  limit?: number;
  batchSize?: number;
  /** Injectable delay between batches (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
  interBatchDelayMs?: number;
}

export interface PriceSnapshotResult {
  skipped: boolean;
  reason?: string;
  targets: number;
  pointsWritten: number;
  deduped: number;
  failures: number;
  durationMs: number;
}

const LOCK_KEY = 'job:price-snapshot';
const LOCK_TTL_MS = 10 * 60_000;

export async function runPriceSnapshot(
  deps: JobDeps,
  options: PriceSnapshotOptions = {},
): Promise<PriceSnapshotResult> {
  const { store, pricing, lock, clock, logger } = deps;
  const startedAt = clock.now();
  const limit = options.limit ?? 500;
  const batchSize = options.batchSize ?? 25;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const delay = options.interBatchDelayMs ?? 1000;

  const handle = await lock.acquire(LOCK_KEY, LOCK_TTL_MS);
  if (!handle) {
    logger.warn('price-snapshot skipped: another run holds the lock');
    return {
      skipped: true,
      reason: 'locked',
      targets: 0,
      pointsWritten: 0,
      deduped: 0,
      failures: 0,
      durationMs: 0,
    };
  }

  let pointsWritten = 0;
  let deduped = 0;
  let failures = 0;
  let targetCount = 0;

  try {
    const targets = (await store.listRefreshTargets(limit)).sort((a, b) => b.priority - a.priority);
    targetCount = targets.length;
    logger.info('price-snapshot targets resolved', { count: targetCount });

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      const collected: PricePointWrite[] = [];
      await Promise.all(
        batch.map(async (t) => {
          try {
            const points = await pricing.allCurrentPoints(t.cardExternalId);
            collected.push(...points);
          } catch (err) {
            failures += 1;
            logger.warn('price-snapshot fetch failed', {
              card: t.cardExternalId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
      if (collected.length > 0) {
        const res = await store.upsertPricePoints(collected);
        pointsWritten += res.inserted;
        deduped += res.deduped;
      }
      // Respect provider rate limits between batches.
      if (i + batchSize < targets.length && delay > 0) await sleep(delay);
    }

    const finishedAt = clock.now();
    await store.recordSyncRun({
      job: 'price-snapshot',
      status: 'succeeded',
      processed: targetCount,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });
    return {
      skipped: false,
      targets: targetCount,
      pointsWritten,
      deduped,
      failures,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  } catch (err) {
    await store.recordSyncRun({
      job: 'price-snapshot',
      status: 'failed',
      processed: targetCount,
      startedAt: startedAt.toISOString(),
      finishedAt: clock.now().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await handle.release();
  }
}
