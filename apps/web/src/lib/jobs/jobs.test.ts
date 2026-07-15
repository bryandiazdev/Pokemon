import { describe, it, expect, beforeEach } from 'vitest';
import { DemoJobStore } from './demo-store';
import { runPriceSnapshot } from './price-snapshot';
import { runPortfolioSnapshots } from './portfolio-snapshot';
import { runAlertEvaluation, shouldTrigger } from './alert-evaluation';
import type { JobDeps, Lock, LockHandle, PricingSource, PricePointWrite, AlertRow } from './types';

// --- Test doubles ---------------------------------------------------------

class FakeLock implements Lock {
  held = new Set<string>();
  fail = false;
  async acquire(key: string): Promise<LockHandle | null> {
    if (this.fail || this.held.has(key)) return null;
    this.held.add(key);
    return { release: async () => void this.held.delete(key) };
  }
}

const fixedClock = (iso: string) => ({ now: () => new Date(iso) });
const noopLogger = { info: () => {}, warn: () => {} };

/** Deterministic pricing: raw NM = $200, PSA10 = $2000 for base1-4; others $50. */
const fakePricing: PricingSource = {
  async currentRawMinor(card) {
    return card === 'base1-4' ? 20000 : 5000;
  },
  async currentGradedMinor(card, _c, grade) {
    if (card === 'base1-4' && grade === '9') return 180000;
    return 100000;
  },
  async allCurrentPoints(card): Promise<PricePointWrite[]> {
    return [
      {
        cardExternalId: card,
        provider: 'demo',
        market: 'demo',
        currency: 'USD',
        condition: 'near_mint',
        valueMinor: card === 'base1-4' ? 20000 : 5000,
        recordedForDate: '2024-07-01',
      },
    ];
  },
};

function deps(store: DemoJobStore, lock: Lock, iso = '2024-07-01T12:00:00Z'): JobDeps {
  return { store, pricing: fakePricing, lock, clock: fixedClock(iso), logger: noopLogger };
}

// --- Tests ----------------------------------------------------------------

describe('price snapshot job', () => {
  let store: DemoJobStore;
  let lock: FakeLock;
  beforeEach(() => {
    store = new DemoJobStore();
    lock = new FakeLock();
  });

  it('writes price points prioritizing owned cards, idempotently', async () => {
    const opts = { sleep: async () => {}, interBatchDelayMs: 0, batchSize: 2 };
    const first = await runPriceSnapshot(deps(store, lock), opts);
    expect(first.skipped).toBe(false);
    expect(first.pointsWritten).toBeGreaterThan(0);
    const afterFirst = store.pricePoints.length;

    // Re-running the same day dedupes (idempotent), not double-counts.
    const second = await runPriceSnapshot(deps(store, lock), opts);
    expect(second.deduped).toBeGreaterThan(0);
    expect(store.pricePoints.length).toBe(afterFirst);
    expect(store.syncRuns.filter((r) => r.job === 'price-snapshot')).toHaveLength(2);
  });

  it('skips when the lock is already held (no double-processing)', async () => {
    lock.fail = true;
    const res = await runPriceSnapshot(deps(store, lock), { sleep: async () => {} });
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe('locked');
    expect(store.pricePoints.length).toBe(0);
  });
});

describe('portfolio snapshot job', () => {
  it('values the collection and is idempotent per day', async () => {
    const store = new DemoJobStore();
    const lock = new FakeLock();
    const r1 = await runPortfolioSnapshots(deps(store, lock));
    expect(r1.snapshotsWritten).toBe(1);
    const snap = store.snapshots[0]!;
    expect(snap.totalMarketValueMinor).toBeGreaterThan(0);
    expect(snap.cardCount).toBeGreaterThan(0);
    // Gain = market - cost basis.
    expect(snap.unrealizedGainMinor).toBe(snap.totalMarketValueMinor - snap.totalCostBasisMinor);

    const r2 = await runPortfolioSnapshots(deps(store, lock));
    expect(r2.snapshotsWritten).toBe(0); // same day → upsert, not a new row
    expect(store.snapshots.length).toBe(1);
  });
});

describe('alert evaluation job', () => {
  it('triggers an above-threshold alert once and respects cooldown', async () => {
    const store = new DemoJobStore();
    const lock = new FakeLock();
    const r1 = await runAlertEvaluation(deps(store, lock));
    expect(r1.triggered).toBe(1); // base1-4 @ $200 >= $100 target; Mew below-$10 does not
    expect(store.notifications).toHaveLength(1);
    expect(store.notifications[0]?.actionUrl).toContain('base1-4');

    // Immediately re-running: the just-fired alert is in cooldown.
    const r2 = await runAlertEvaluation(deps(store, lock, '2024-07-01T13:00:00Z'));
    expect(r2.triggered).toBe(0);
    expect(r2.skippedCooldown).toBe(1);
  });

  it('shouldTrigger pure logic covers each direction', () => {
    const base: AlertRow = {
      id: 'a',
      userId: 'u',
      cardExternalId: 'c',
      direction: 'above',
      threshold: 100,
      cadence: 'immediate',
      enabled: true,
    };
    expect(shouldTrigger({ ...base, direction: 'above' }, 15000, undefined)).toBe(true);
    expect(shouldTrigger({ ...base, direction: 'above' }, 5000, undefined)).toBe(false);
    expect(shouldTrigger({ ...base, direction: 'below' }, 5000, undefined)).toBe(true);
    expect(
      shouldTrigger({ ...base, direction: 'pct_increase', percentageChange: 20 }, 130, 100),
    ).toBe(true);
    expect(
      shouldTrigger({ ...base, direction: 'pct_decrease', percentageChange: 20 }, 70, 100),
    ).toBe(true);
    expect(shouldTrigger(base, undefined, undefined)).toBe(false);
  });
});
