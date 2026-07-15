/**
 * Enum-like const arrays mirroring the Postgres enum types and CHECK constraints
 * defined in the migrations. Keep these in sync with migrations/0002_enums.sql.
 */

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLAN_TIERS = ['free', 'collector_pro'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const OWNERSHIP_TYPES = ['raw', 'graded'] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const GRADING_COMPANIES = ['psa', 'bgs', 'cgc', 'sgc', 'tag', 'ace', 'other'] as const;
export type GradingCompany = (typeof GRADING_COMPANIES)[number];

export const RAW_CONDITIONS = [
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged',
  'unspecified',
] as const;
export type RawCondition = (typeof RAW_CONDITIONS)[number];

export const FINISHES = [
  'normal',
  'holo',
  'reverse_holo',
  'first_edition',
  'unlimited',
  'shadowless',
  'other',
] as const;
export type CardFinish = (typeof FINISHES)[number];

// Editions surfaced in the UI (a subset of finishes that describe print runs).
export const EDITIONS = ['first_edition', 'unlimited', 'shadowless'] as const;
export type Edition = (typeof EDITIONS)[number];

export const SCAN_TYPES = ['quick', 'grade'] as const;
export type ScanTypeValue = (typeof SCAN_TYPES)[number];

export const SCAN_STATUSES = [
  'pending',
  'processing',
  'awaiting_confirmation',
  'completed',
  'failed',
  'abandoned',
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const CAPTURE_TYPES = [
  'front',
  'back',
  'front_angled',
  'back_angled',
  'corner_tl',
  'corner_tr',
  'corner_bl',
  'corner_br',
  'edge_top',
  'edge_bottom',
  'edge_left',
  'edge_right',
  'surface_video',
] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

export const ALERT_DIRECTIONS = ['above', 'below', 'pct_increase', 'pct_decrease'] as const;
export type AlertDirection = (typeof ALERT_DIRECTIONS)[number];

export const ALERT_CADENCES = ['immediate', 'daily', 'weekly'] as const;
export type AlertCadence = (typeof ALERT_CADENCES)[number];

export const NOTIFICATION_TYPES = [
  'price_alert',
  'digest',
  'system',
  'grade_report',
  'import',
  'export',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const VALUATION_TYPES = ['market', 'low', 'high', 'mid', 'estimate'] as const;
export type ValuationType = (typeof VALUATION_TYPES)[number];

export const COLLECTION_VISIBILITIES = ['private', 'unlisted', 'public'] as const;
export type CollectionVisibility = (typeof COLLECTION_VISIBILITIES)[number];

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const DATA_QUALITY_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type DataQualitySeverity = (typeof DATA_QUALITY_SEVERITIES)[number];

export const SUBMISSION_RECOMMENDATIONS = [
  'submit',
  'do_not_submit',
  'borderline',
  'submit_high_value_only',
  'crossover',
  'regrade',
] as const;
export type SubmissionRecommendation = (typeof SUBMISSION_RECOMMENDATIONS)[number];

/** Sentinel used across the schema to mean "unlimited" for numeric limit columns. */
export const UNLIMITED = -1 as const;
