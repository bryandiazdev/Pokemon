import type { JobDeps, AlertRow } from './types';

/**
 * Alert-evaluation job. Evaluates each enabled alert against current prices,
 * respects a cadence-based cooldown to prevent spam, deduplicates, and writes an
 * in-app notification (email delivery is dispatched from the same seam). Safe to
 * run repeatedly — cooldowns make it idempotent within a window.
 */

export interface AlertEvaluationResult {
  evaluated: number;
  triggered: number;
  skippedCooldown: number;
}

const COOLDOWN_MS: Record<AlertRow['cadence'], number> = {
  immediate: 6 * 60 * 60_000, // don't fire the same alert more than ~4×/day
  daily: 24 * 60 * 60_000,
  weekly: 7 * 24 * 60 * 60_000,
};

function inCooldown(alert: AlertRow, now: Date): boolean {
  if (!alert.lastTriggeredAt) return false;
  const last = new Date(alert.lastTriggeredAt).getTime();
  return now.getTime() - last < COOLDOWN_MS[alert.cadence];
}

/** Pure decision function — exported for direct unit testing. */
export function shouldTrigger(
  alert: AlertRow,
  currentMinor: number | undefined,
  priorMinor: number | undefined,
): boolean {
  if (currentMinor == null) return false;
  switch (alert.direction) {
    case 'above':
      return alert.threshold != null && currentMinor >= alert.threshold;
    case 'below':
      return alert.threshold != null && currentMinor <= alert.threshold;
    case 'pct_increase': {
      if (priorMinor == null || priorMinor === 0 || alert.percentageChange == null) return false;
      return ((currentMinor - priorMinor) / priorMinor) * 100 >= alert.percentageChange;
    }
    case 'pct_decrease': {
      if (priorMinor == null || priorMinor === 0 || alert.percentageChange == null) return false;
      return ((priorMinor - currentMinor) / priorMinor) * 100 >= alert.percentageChange;
    }
    default:
      return false;
  }
}

export async function runAlertEvaluation(deps: JobDeps): Promise<AlertEvaluationResult> {
  const { store, pricing, clock, logger } = deps;
  const now = clock.now();
  const alerts = await store.listEnabledAlerts();

  let triggered = 0;
  let skippedCooldown = 0;

  for (const alert of alerts) {
    if (inCooldown(alert, now)) {
      skippedCooldown += 1;
      continue;
    }

    const currentMinor =
      alert.gradingCompany && alert.grade
        ? await pricing.currentGradedMinor(alert.cardExternalId, alert.gradingCompany, alert.grade)
        : await pricing.currentRawMinor(alert.cardExternalId, alert.condition ?? 'near_mint');

    const priorMinor =
      alert.direction === 'pct_increase' || alert.direction === 'pct_decrease'
        ? await store.priorPriceMinor(
            {
              cardExternalId: alert.cardExternalId,
              condition: alert.condition,
              gradingCompany: alert.gradingCompany,
              grade: alert.grade,
            },
            7,
          )
        : undefined;

    if (!shouldTrigger(alert, currentMinor, priorMinor)) continue;

    await store.createNotification({
      userId: alert.userId,
      type: 'price_alert',
      title: 'Price alert triggered',
      body: describeAlert(alert, currentMinor!),
      actionUrl: `/cards/${alert.cardExternalId}`,
    });
    await store.markAlertTriggered(alert.id, now.toISOString());
    triggered += 1;
  }

  logger.info('alert-evaluation complete', { evaluated: alerts.length, triggered, skippedCooldown });
  await store.recordSyncRun({
    job: 'alert-evaluation',
    status: 'succeeded',
    processed: alerts.length,
    startedAt: now.toISOString(),
    finishedAt: clock.now().toISOString(),
  });

  return { evaluated: alerts.length, triggered, skippedCooldown };
}

function describeAlert(alert: AlertRow, currentMinor: number): string {
  const value = `$${(currentMinor / 100).toFixed(2)}`;
  const target = alert.threshold != null ? `$${(alert.threshold / 100).toFixed(2)}` : '';
  switch (alert.direction) {
    case 'above':
      return `Now ${value}, at or above your ${target} target.`;
    case 'below':
      return `Now ${value}, at or below your ${target} target.`;
    case 'pct_increase':
      return `Up at least ${alert.percentageChange}% — now ${value}.`;
    case 'pct_decrease':
      return `Down at least ${alert.percentageChange}% — now ${value}.`;
    default:
      return `Now ${value}.`;
  }
}
