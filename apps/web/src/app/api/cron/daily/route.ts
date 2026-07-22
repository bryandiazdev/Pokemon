import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import {
  getJobDeps,
  runPriceSnapshot,
  runPortfolioSnapshots,
  runAlertEvaluation,
} from '@/lib/jobs';

/**
 * Daily sync, invoked by the Vercel cron (see vercel.json). Runs the price
 * snapshot (accrues real history for owned/watched cards), portfolio
 * snapshots, and alert evaluation — the pipeline that makes price alerts
 * actually fire.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env var
 * is set. Without CRON_SECRET configured the route refuses to run rather than
 * being publicly triggerable.
 */
// 60s is the Hobby-plan ceiling; the snapshot batches respect this budget.
export const maxDuration = 60;

export const GET = withErrorHandling(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return jsonError('forbidden', 'CRON_SECRET is not configured.');
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return jsonError('forbidden', 'Invalid cron authorization.');
  }

  const deps = getJobDeps();
  const startedAt = Date.now();
  const prices = await runPriceSnapshot(deps);
  const portfolios = await runPortfolioSnapshots(deps);
  const alerts = await runAlertEvaluation(deps);
  return jsonOk({ prices, portfolios, alerts, durationMs: Date.now() - startedAt });
});
