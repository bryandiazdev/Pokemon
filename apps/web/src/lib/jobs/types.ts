/**
 * Job domain types + injectable dependencies.
 *
 * Job LOGIC is written against these interfaces so it is fully unit-testable
 * with in-memory fakes and has no hard dependency on the Trigger.dev runtime,
 * Supabase, or Redis. Production wiring lives in `deps.ts`; the Trigger.dev
 * tasks in `src/trigger/*` are thin wrappers that call these functions.
 */

import type { GradingCompany, RawCondition } from '@psr/types';

export interface RefreshTarget {
  cardExternalId: string;
  /** Higher = refreshed first (owned/watched by paying users rank highest). */
  priority: number;
  reason: 'collection' | 'watchlist' | 'recent' | 'popular' | 'new_set';
}

export interface PricePointWrite {
  cardExternalId: string;
  provider: string;
  market: string;
  currency: string;
  condition?: RawCondition;
  gradingCompany?: GradingCompany;
  grade?: string;
  valueMinor: number;
  lowMinor?: number;
  highMinor?: number;
  recordedForDate: string; // ISO date — the daily snapshot key
}

export interface ValuationItem {
  userId: string;
  cardExternalId: string;
  quantity: number;
  ownershipType: 'raw' | 'graded';
  gradingCompany?: GradingCompany;
  grade?: string;
  rawCondition?: RawCondition;
  purchasePriceMinor: number;
}

export interface PortfolioSnapshotWrite {
  userId: string;
  snapshotDate: string;
  totalMarketValueMinor: number;
  totalCostBasisMinor: number;
  unrealizedGainMinor: number;
  cardCount: number;
  gradedCardCount: number;
  rawCardCount: number;
}

export interface AlertRow {
  id: string;
  userId: string;
  cardExternalId: string;
  direction: 'above' | 'below' | 'pct_increase' | 'pct_decrease';
  threshold?: number; // major units (e.g. dollars)
  percentageChange?: number; // percent
  condition?: RawCondition;
  gradingCompany?: GradingCompany;
  grade?: string;
  cadence: 'immediate' | 'daily' | 'weekly';
  enabled: boolean;
  lastTriggeredAt?: string;
}

export interface NotificationWrite {
  userId: string;
  type: 'price_alert';
  title: string;
  body: string;
  actionUrl?: string;
}

export interface SyncRunWrite {
  job: string;
  status: 'succeeded' | 'failed';
  processed: number;
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export interface PriceQuery {
  cardExternalId: string;
  condition?: RawCondition;
  gradingCompany?: GradingCompany;
  grade?: string;
}

/** Persistence surface each job needs. */
export interface JobStore {
  listRefreshTargets(limit: number): Promise<RefreshTarget[]>;
  upsertPricePoints(points: PricePointWrite[]): Promise<{ inserted: number; deduped: number }>;
  listUsersWithCollections(): Promise<string[]>;
  getValuationItems(userId: string): Promise<ValuationItem[]>;
  upsertPortfolioSnapshot(snapshot: PortfolioSnapshotWrite): Promise<{ inserted: boolean }>;
  listEnabledAlerts(): Promise<AlertRow[]>;
  /** Latest observed value (minor units) for an alert/valuation query, if any. */
  latestPriceMinor(query: PriceQuery): Promise<number | undefined>;
  /** Value N days ago (minor units) for percentage-change alerts, if any. */
  priorPriceMinor(query: PriceQuery, daysAgo: number): Promise<number | undefined>;
  createNotification(notification: NotificationWrite): Promise<void>;
  markAlertTriggered(alertId: string, at: string): Promise<void>;
  recordSyncRun(run: SyncRunWrite): Promise<void>;
}

/** Current-price source (the provider registry in production). */
export interface PricingSource {
  currentRawMinor(cardExternalId: string, condition: RawCondition): Promise<number | undefined>;
  currentGradedMinor(
    cardExternalId: string,
    gradingCompany: GradingCompany,
    grade: string,
  ): Promise<number | undefined>;
  /** All current price points for a card, for snapshotting. */
  allCurrentPoints(cardExternalId: string): Promise<PricePointWrite[]>;
}

export interface LockHandle {
  release(): Promise<void>;
}

/** Distributed lock so concurrent job runs never double-process. */
export interface Lock {
  acquire(key: string, ttlMs: number): Promise<LockHandle | null>;
}

export interface Clock {
  now(): Date;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface JobDeps {
  store: JobStore;
  pricing: PricingSource;
  lock: Lock;
  clock: Clock;
  logger: Logger;
}
