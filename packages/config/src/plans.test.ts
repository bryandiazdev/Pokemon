import { describe, it, expect } from 'vitest';
import {
  PLAN_DEFAULTS,
  PLAN_PRICING,
  annualSavingsPct,
  priceIdFor,
  planForPriceId,
  statusGrantsPaidAccess,
  type PriceIdEnv,
} from './plans';

const ENV: PriceIdEnv = {
  STRIPE_COLLECTOR_MONTHLY_PRICE_ID: 'price_col_m',
  STRIPE_COLLECTOR_ANNUAL_PRICE_ID: 'price_col_y',
  STRIPE_PRO_MONTHLY_PRICE_ID: 'price_pro_m',
  STRIPE_PRO_ANNUAL_PRICE_ID: 'price_pro_y',
};

describe('plan catalog', () => {
  it('encodes the launch entitlements', () => {
    expect(PLAN_DEFAULTS.free.quickScanMonthlyLimit).toBe(25);
    expect(PLAN_DEFAULTS.free.collectionLimit).toBe(100);
    expect(PLAN_DEFAULTS.free.gradeScanMonthlyLimit).toBe(0);
    expect(PLAN_DEFAULTS.collector.quickScanMonthlyLimit).toBe(500);
    expect(PLAN_DEFAULTS.collector.collectionLimit).toBe(-1);
    expect(PLAN_DEFAULTS.collector.gradeScanMonthlyLimit).toBe(0); // AI stays Pro-only
    expect(PLAN_DEFAULTS.collector.alertsLimit).toBe(25);
    expect(PLAN_DEFAULTS.pro.quickScanMonthlyLimit).toBe(2000);
    expect(PLAN_DEFAULTS.pro.gradeScanMonthlyLimit).toBe(30);
    expect(PLAN_DEFAULTS.pro.alertsLimit).toBe(250);
  });

  it('maps price IDs to plans and back (allowlist)', () => {
    expect(priceIdFor(ENV, { plan: 'collector', interval: 'month' })).toBe('price_col_m');
    expect(priceIdFor(ENV, { plan: 'pro', interval: 'year' })).toBe('price_pro_y');
    expect(planForPriceId(ENV, 'price_col_y')).toEqual({ plan: 'collector', interval: 'year' });
    expect(planForPriceId(ENV, 'price_pro_m')).toEqual({ plan: 'pro', interval: 'month' });
    expect(planForPriceId(ENV, 'price_unknown')).toBeNull();
    expect(planForPriceId(ENV, null)).toBeNull();
  });

  it('computes honest annual savings from the real prices', () => {
    // Collector: $95.88/yr monthly vs $79 → 17.6% → 18.
    expect(annualSavingsPct('collector')).toBe(18);
    // Pro: $239.88 vs $199 → 17.04% → 17.
    expect(annualSavingsPct('pro')).toBe(17);
    expect(PLAN_PRICING.collector.month).toBe(799);
    expect(PLAN_PRICING.pro.year).toBe(19900);
  });

  it('grants paid access only for active/trialing/past_due (grace)', () => {
    expect(statusGrantsPaidAccess('active')).toBe(true);
    expect(statusGrantsPaidAccess('trialing')).toBe(true);
    expect(statusGrantsPaidAccess('past_due')).toBe(true); // documented grace period
    for (const s of ['unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused']) {
      expect(statusGrantsPaidAccess(s)).toBe(false);
    }
  });
});
