/**
 * @psr/database — public entrypoint.
 * Re-exports the generated Database types, enum constants, and small typed helpers.
 */

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  Profile,
  AdminRole,
  Subscription,
  Entitlement,
  UsagePeriod,
  StripeWebhookEvent,
  Set_,
  Card,
  CardVariant,
  ExternalIdMapping,
  Collection,
  CollectionItem,
  UserTag,
  CollectionItemTag,
  PricePoint,
  PortfolioSnapshot,
  CurrencyRate,
  ScanSession,
  ScanImage,
  RecognitionCandidate,
  GradeReport,
  GradeFinding,
  ActualGradingResult,
  GradeTrainingExample,
  WatchlistItem,
  PriceAlert,
  Notification,
  EmailPreference,
  ProviderRequestLog,
  ProviderSyncRun,
  BackgroundJob,
  FeatureFlag,
  AuditLog,
  SavedSearch,
  ImportJob,
  ExportJob,
  DataQualityIssue,
  ApiKey,
} from './types.js';

export * from './constants.js';

import { UNLIMITED } from './constants.js';

/** True when an entitlement limit column represents "unlimited" (-1 sentinel). */
export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED;
}

/**
 * True when `used` is still within `limit`. An unlimited (-1) limit is never exceeded.
 */
export function isWithinLimit(used: number, limit: number): boolean {
  if (isUnlimited(limit)) return true;
  return used < limit;
}

/** Remaining allowance, or null when unlimited. Never negative. */
export function remainingAllowance(used: number, limit: number): number | null {
  if (isUnlimited(limit)) return null;
  return Math.max(0, limit - used);
}

/** Format integer minor units (e.g. cents) as a decimal string, e.g. 12345 -> "123.45". */
export function minorUnitsToDecimalString(minor: number, fractionDigits = 2): string {
  const factor = 10 ** fractionDigits;
  return (minor / factor).toFixed(fractionDigits);
}

/** Convert a major-unit amount (e.g. dollars) to integer minor units. */
export function toMinorUnits(major: number, fractionDigits = 2): number {
  const factor = 10 ** fractionDigits;
  return Math.round(major * factor);
}
