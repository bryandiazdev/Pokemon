import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { isDemo } from '@/lib/env';
import {
  getJobDeps,
  runPriceSnapshot,
  runPortfolioSnapshots,
  runAlertEvaluation,
} from '@/lib/jobs';

/**
 * On-demand job trigger for admins (and the demo user in demo mode). In
 * production the Trigger.dev scheduler runs these on a cron; this route is for
 * manual re-runs from the admin dashboard. Authorization is server-side.
 */
const bodySchema = z.object({
  job: z.enum(['price-snapshot', 'portfolio-snapshot', 'alert-evaluation', 'daily-sync']),
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  // Real admin gating happens via admin_roles/profiles.is_admin in live mode.
  if (!user || (!isDemo && !user.isDemo)) {
    return jsonError('forbidden', 'Admin access required.');
  }

  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const deps = getJobDeps();
  switch (parsed.value.job) {
    case 'price-snapshot':
      return jsonOk(await runPriceSnapshot(deps));
    case 'portfolio-snapshot':
      return jsonOk(await runPortfolioSnapshots(deps));
    case 'alert-evaluation':
      return jsonOk(await runAlertEvaluation(deps));
    case 'daily-sync': {
      const prices = await runPriceSnapshot(deps);
      const portfolios = await runPortfolioSnapshots(deps);
      const alerts = await runAlertEvaluation(deps);
      return jsonOk({ prices, portfolios, alerts });
    }
  }
});
