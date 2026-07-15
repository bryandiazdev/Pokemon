/** Domain enums & value objects shared across web, jobs, and providers. */

import type { DataFreshness } from './api';
import type { Money } from './money';

export const RAW_CONDITIONS = [
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged',
  'unspecified',
] as const;
export type RawCondition = (typeof RAW_CONDITIONS)[number];

export const GRADING_COMPANIES = ['psa', 'bgs', 'cgc', 'sgc', 'tag', 'ace', 'other'] as const;
export type GradingCompany = (typeof GRADING_COMPANIES)[number];

export const CARD_FINISHES = [
  'normal',
  'holo',
  'reverse_holo',
  'first_edition',
  'unlimited',
  'shadowless',
  'other',
] as const;
export type CardFinish = (typeof CARD_FINISHES)[number];

export const OWNERSHIP_TYPES = ['raw', 'graded'] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const PLAN_TIERS = ['free', 'collector_pro'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

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

export const SUBMISSION_RECOMMENDATIONS = [
  'Strong submission candidate',
  'Possible submission candidate',
  'Borderline; inspect manually',
  'Unlikely to justify grading financially',
  'Insufficient image quality',
  'Serious condition issue detected',
] as const;
export type SubmissionRecommendation = (typeof SUBMISSION_RECOMMENDATIONS)[number];

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

export type Language = 'en' | 'ja' | 'fr' | 'de' | 'es' | 'it' | 'ko' | 'zh' | (string & {});

/** A price value with provenance and freshness — never a bare number in the UI. */
export interface PricePoint {
  value: Money;
  low?: Money;
  high?: Money;
  provider: string;
  market: string;
  condition?: RawCondition;
  gradingCompany?: GradingCompany;
  grade?: string;
  sampleSize?: number;
  recordedForDate: string; // ISO date
  freshness: DataFreshness;
}

export interface PricePointSeries {
  points: Array<{ date: string; value: Money; freshness: DataFreshness }>;
  currency: string;
}

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}
