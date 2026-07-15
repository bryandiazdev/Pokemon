import { DEMO_CARDS, DEMO_COLLECTION_ITEMS, DEMO_USER } from '@psr/testing';
import type {
  JobStore,
  RefreshTarget,
  PricePointWrite,
  ValuationItem,
  PortfolioSnapshotWrite,
  AlertRow,
  NotificationWrite,
  SyncRunWrite,
  PriceQuery,
} from './types';

/**
 * In-memory JobStore backed by demo fixtures. Persists writes for the lifetime
 * of the process so the daily-sync sequence (snapshot → portfolio → alerts) and
 * on-demand admin runs behave realistically. Used in demo mode and by tests.
 */
export class DemoJobStore implements JobStore {
  readonly pricePoints: PricePointWrite[] = [];
  readonly snapshots: PortfolioSnapshotWrite[] = [];
  readonly notifications: NotificationWrite[] = [];
  readonly syncRuns: SyncRunWrite[] = [];
  private readonly alertState = new Map<string, string>(); // id -> lastTriggeredAt
  private readonly alerts: AlertRow[];

  constructor(alerts?: AlertRow[]) {
    this.alerts =
      alerts ??
      [
        {
          id: 'demo-alert-1',
          userId: DEMO_USER.id,
          cardExternalId: 'base1-4',
          direction: 'above',
          threshold: 100, // $100 — demo Charizard NM is well above this, so it triggers
          cadence: 'daily',
          enabled: true,
        },
        {
          id: 'demo-alert-2',
          userId: DEMO_USER.id,
          cardExternalId: 'sv4pt5-193',
          direction: 'below',
          threshold: 10, // $10 — demo Mew ex NM is above this, so it does NOT trigger
          cadence: 'daily',
          enabled: true,
        },
      ];
  }

  async listRefreshTargets(limit: number): Promise<RefreshTarget[]> {
    const owned = new Set(DEMO_COLLECTION_ITEMS.map((i) => i.cardExternalId));
    return DEMO_CARDS.slice(0, limit).map((c) => ({
      cardExternalId: c.externalId,
      priority: owned.has(c.externalId) ? 100 : 10,
      reason: owned.has(c.externalId) ? ('collection' as const) : ('popular' as const),
    }));
  }

  async upsertPricePoints(points: PricePointWrite[]): Promise<{ inserted: number; deduped: number }> {
    let inserted = 0;
    let deduped = 0;
    for (const p of points) {
      const key = this.dailyKey(p);
      const existing = this.pricePoints.findIndex((x) => this.dailyKey(x) === key);
      if (existing >= 0) {
        this.pricePoints[existing] = p; // upsert
        deduped += 1;
      } else {
        this.pricePoints.push(p);
        inserted += 1;
      }
    }
    return { inserted, deduped };
  }

  async listUsersWithCollections(): Promise<string[]> {
    return [DEMO_USER.id];
  }

  async getValuationItems(userId: string): Promise<ValuationItem[]> {
    return DEMO_COLLECTION_ITEMS.map((i) => ({
      userId,
      cardExternalId: i.cardExternalId,
      quantity: i.quantity,
      ownershipType: i.ownershipType,
      gradingCompany: 'gradingCompany' in i ? i.gradingCompany : undefined,
      grade: 'grade' in i ? i.grade : undefined,
      rawCondition: 'rawCondition' in i ? i.rawCondition : undefined,
      purchasePriceMinor: i.purchasePriceMinor,
    }));
  }

  async upsertPortfolioSnapshot(snapshot: PortfolioSnapshotWrite): Promise<{ inserted: boolean }> {
    const idx = this.snapshots.findIndex(
      (s) => s.userId === snapshot.userId && s.snapshotDate === snapshot.snapshotDate,
    );
    if (idx >= 0) {
      this.snapshots[idx] = snapshot;
      return { inserted: false };
    }
    this.snapshots.push(snapshot);
    return { inserted: true };
  }

  async listEnabledAlerts(): Promise<AlertRow[]> {
    return this.alerts
      .filter((a) => a.enabled)
      .map((a) => ({ ...a, lastTriggeredAt: this.alertState.get(a.id) ?? a.lastTriggeredAt }));
  }

  async latestPriceMinor(query: PriceQuery): Promise<number | undefined> {
    const matches = this.pricePoints
      .filter((p) => this.matchesQuery(p, query))
      .sort((a, b) => b.recordedForDate.localeCompare(a.recordedForDate));
    return matches[0]?.valueMinor;
  }

  async priorPriceMinor(query: PriceQuery, _daysAgo: number): Promise<number | undefined> {
    // Demo store has only same-day points; simulate a prior value at 90% for tests.
    const latest = await this.latestPriceMinor(query);
    return latest != null ? Math.round(latest * 0.9) : undefined;
  }

  async createNotification(notification: NotificationWrite): Promise<void> {
    this.notifications.push(notification);
  }

  async markAlertTriggered(alertId: string, at: string): Promise<void> {
    this.alertState.set(alertId, at);
  }

  async recordSyncRun(run: SyncRunWrite): Promise<void> {
    this.syncRuns.push(run);
  }

  private dailyKey(p: PricePointWrite): string {
    return [
      p.provider,
      p.cardExternalId,
      p.market,
      p.currency,
      p.condition ?? '_',
      p.gradingCompany ?? '_',
      p.grade ?? '_',
      p.recordedForDate,
    ].join('|');
  }

  private matchesQuery(p: PricePointWrite, q: PriceQuery): boolean {
    if (p.cardExternalId !== q.cardExternalId) return false;
    if (q.gradingCompany) return p.gradingCompany === q.gradingCompany && p.grade === q.grade;
    return p.gradingCompany == null && (q.condition == null || p.condition === q.condition);
  }
}
