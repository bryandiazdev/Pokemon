/**
 * Deterministic DEMO price generator. Produces raw-by-condition, graded-by-grade,
 * and daily history with a reproducible seeded wobble so charts render — but the
 * values are illustrative, never presented as live market data.
 */

import type {
  NormalizedGradedPrice,
  NormalizedPrice,
  NormalizedPricePoint,
} from '../interfaces';
import type { RawCondition, GradingCompany } from '@psr/types';
import { DEMO_PSA10_MULTIPLIER, DEMO_RAW_BASE_MINOR } from './data';

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random in [0,1) from a seed. */
function seeded(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const CONDITION_FACTOR: Record<RawCondition, number> = {
  near_mint: 1,
  lightly_played: 0.78,
  moderately_played: 0.55,
  heavily_played: 0.35,
  damaged: 0.2,
  unspecified: 0.85,
};

const PSA_GRADE_FACTOR: Record<string, number> = {
  '10': 1,
  '9': 0.42,
  '8': 0.22,
  '7': 0.14,
};

function baseMinor(cardExternalId: string): number {
  return DEMO_RAW_BASE_MINOR[cardExternalId] ?? 1500;
}

export function demoRawPrices(cardExternalId: string, date: string): NormalizedPrice[] {
  const base = baseMinor(cardExternalId);
  return (Object.keys(CONDITION_FACTOR) as RawCondition[]).map((condition) => {
    const value = Math.round(base * CONDITION_FACTOR[condition]);
    return {
      provider: 'demo',
      market: 'demo-market',
      currency: 'USD',
      condition,
      valueMinor: value,
      lowMinor: Math.round(value * 0.85),
      highMinor: Math.round(value * 1.18),
      sampleSize: 12,
      valuationType: 'market' as const,
      recordedForDate: date,
      freshness: 'demo' as const,
    };
  });
}

const GRADED_COMPANIES: GradingCompany[] = ['psa', 'bgs', 'cgc'];

export function demoGradedPrices(
  cardExternalId: string,
  date: string,
): NormalizedGradedPrice[] {
  const base = baseMinor(cardExternalId);
  const psa10 = Math.round(base * (DEMO_PSA10_MULTIPLIER[cardExternalId] ?? 3));
  const out: NormalizedGradedPrice[] = [];
  for (const company of GRADED_COMPANIES) {
    // BGS/CGC priced relative to PSA for the demo.
    const companyFactor = company === 'psa' ? 1 : company === 'bgs' ? 0.92 : 0.85;
    for (const grade of Object.keys(PSA_GRADE_FACTOR)) {
      if ((company === 'bgs' || company === 'cgc') && grade === '7') continue;
      const value = Math.round(psa10 * (PSA_GRADE_FACTOR[grade] ?? 1) * companyFactor);
      out.push({
        provider: 'demo',
        market: 'demo-market',
        currency: 'USD',
        gradingCompany: company,
        grade,
        valueMinor: value,
        lowMinor: Math.round(value * 0.9),
        highMinor: Math.round(value * 1.15),
        sampleSize: company === 'psa' ? 40 : 8,
        valuationType: 'market',
        recordedForDate: date,
        freshness: 'demo',
      });
    }
  }
  return out;
}

/** Daily history with a small deterministic random walk. */
export function demoHistory(
  cardExternalId: string,
  from: string,
  to: string,
  opts: { grade?: string; company?: GradingCompany } = {},
): NormalizedPricePoint[] {
  const start = new Date(from);
  const end = new Date(to);
  const base = baseMinor(cardExternalId);
  let value =
    opts.grade && opts.company
      ? Math.round(
          base *
            (DEMO_PSA10_MULTIPLIER[cardExternalId] ?? 3) *
            (PSA_GRADE_FACTOR[opts.grade] ?? 0.5),
        )
      : base;
  const points: NormalizedPricePoint[] = [];
  const seedBase = hashSeed(cardExternalId + (opts.grade ?? '') + (opts.company ?? ''));
  let day = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const wobble = (seeded(seedBase + day) - 0.5) * 0.04; // ±2%/day
    value = Math.max(50, Math.round(value * (1 + wobble)));
    points.push({
      date: d.toISOString().slice(0, 10),
      valueMinor: value,
      currency: 'USD',
      freshness: 'demo',
    });
    day++;
  }
  return points;
}
