import type { JobDeps } from './types';

/**
 * Daily portfolio-snapshot job. Values every user's collection at current
 * prices and writes one `portfolio_snapshots` row per user per day. Idempotent
 * via the unique (user_id, snapshot_date) constraint.
 */

export interface PortfolioSnapshotResult {
  users: number;
  snapshotsWritten: number;
  durationMs: number;
}

export async function runPortfolioSnapshots(deps: JobDeps): Promise<PortfolioSnapshotResult> {
  const { store, pricing, clock, logger } = deps;
  const started = clock.now();
  const snapshotDate = started.toISOString().slice(0, 10);

  const users = await store.listUsersWithCollections();
  let snapshotsWritten = 0;

  for (const userId of users) {
    const items = await store.getValuationItems(userId);
    if (items.length === 0) continue;

    let totalMarket = 0;
    let totalCost = 0;
    let cardCount = 0;
    let gradedCardCount = 0;
    let rawCardCount = 0;

    for (const item of items) {
      const unitMinor =
        item.ownershipType === 'graded' && item.gradingCompany && item.grade
          ? await pricing.currentGradedMinor(item.cardExternalId, item.gradingCompany, item.grade)
          : await pricing.currentRawMinor(item.cardExternalId, item.rawCondition ?? 'near_mint');

      totalMarket += (unitMinor ?? 0) * item.quantity;
      totalCost += item.purchasePriceMinor * item.quantity;
      cardCount += item.quantity;
      if (item.ownershipType === 'graded') gradedCardCount += item.quantity;
      else rawCardCount += item.quantity;
    }

    const { inserted } = await store.upsertPortfolioSnapshot({
      userId,
      snapshotDate,
      totalMarketValueMinor: totalMarket,
      totalCostBasisMinor: totalCost,
      unrealizedGainMinor: totalMarket - totalCost,
      cardCount,
      gradedCardCount,
      rawCardCount,
    });
    if (inserted) snapshotsWritten += 1;
  }

  const finished = clock.now();
  logger.info('portfolio-snapshots complete', { users: users.length, snapshotsWritten });
  await store.recordSyncRun({
    job: 'portfolio-snapshot',
    status: 'succeeded',
    processed: users.length,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
  });

  return {
    users: users.length,
    snapshotsWritten,
    durationMs: finished.getTime() - started.getTime(),
  };
}
