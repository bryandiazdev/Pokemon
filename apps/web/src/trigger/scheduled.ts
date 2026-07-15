import { schedules, task, logger } from '@trigger.dev/sdk/v3';
import {
  getJobDeps,
  runPriceSnapshot,
  runPortfolioSnapshots,
  runAlertEvaluation,
} from '@/lib/jobs';

/**
 * Trigger.dev task definitions — thin, durable wrappers around the tested job
 * functions in `src/lib/jobs`. Retries/observability/concurrency come from
 * Trigger.dev; idempotency + locking come from the job functions themselves.
 */

export const priceSnapshotTask = task({
  id: 'price-snapshot',
  queue: { name: 'sync', concurrencyLimit: 1 },
  run: async () => {
    const result = await runPriceSnapshot(getJobDeps());
    logger.info('price-snapshot done', { ...result });
    return result;
  },
});

export const portfolioSnapshotTask = task({
  id: 'portfolio-snapshot',
  queue: { name: 'sync', concurrencyLimit: 1 },
  run: async () => {
    const result = await runPortfolioSnapshots(getJobDeps());
    logger.info('portfolio-snapshot done', { ...result });
    return result;
  },
});

export const alertEvaluationTask = task({
  id: 'alert-evaluation',
  queue: { name: 'sync', concurrencyLimit: 1 },
  run: async () => {
    const result = await runAlertEvaluation(getJobDeps());
    logger.info('alert-evaluation done', { ...result });
    return result;
  },
});

/**
 * Daily orchestration (06:00 UTC): refresh prices → snapshot portfolios →
 * evaluate alerts, in dependency order. Each step is independently idempotent.
 */
export const dailySync = schedules.task({
  id: 'daily-sync',
  cron: '0 6 * * *',
  run: async () => {
    const deps = getJobDeps();
    const prices = await runPriceSnapshot(deps);
    const portfolios = await runPortfolioSnapshots(deps);
    const alerts = await runAlertEvaluation(deps);
    logger.info('daily-sync complete', {
      prices: prices.pointsWritten,
      portfolios: portfolios.snapshotsWritten,
      alertsTriggered: alerts.triggered,
    });
    return { prices, portfolios, alerts };
  },
});
