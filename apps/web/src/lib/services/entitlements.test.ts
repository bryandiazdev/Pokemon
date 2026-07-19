import { describe, it, expect } from 'vitest';
import { PLAN_DEFAULTS } from '@psr/config';
import {
  checkQuickScan,
  checkGradeScan,
  checkAlertCreate,
  checkCollectionAdd,
  checkExport,
  type EntitlementContext,
  type UsageSnapshot,
} from './entitlements';

function ctx(
  plan: 'free' | 'collector' | 'pro',
  usage: Partial<UsageSnapshot> = {},
): EntitlementContext {
  return {
    userId: 'user-1',
    isDemo: false,
    entitlements: PLAN_DEFAULTS[plan],
    usage: {
      quickScansUsed: 0,
      gradeScansUsed: 0,
      activeAlerts: 0,
      collectionItems: 0,
      ...usage,
    },
  };
}

describe('scan gate', () => {
  it('allows free scans under the limit and reports remaining', () => {
    const r = checkQuickScan(ctx('free', { quickScansUsed: 24 }));
    expect(r).toEqual({ allowed: true, remaining: 1 });
  });

  it('denies the 26th free scan with a Collector recommendation', () => {
    const r = checkQuickScan(ctx('free', { quickScansUsed: 25 }));
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toBe('usage_limit_reached');
      expect(r.paywall.recommendedPlan).toBe('collector');
      expect(r.paywall.limit).toBe(25);
      expect(r.message).toMatch(/Collector/);
    }
  });

  it('gives collector 500 and pro 2000', () => {
    expect(checkQuickScan(ctx('collector', { quickScansUsed: 499 })).allowed).toBe(true);
    expect(checkQuickScan(ctx('collector', { quickScansUsed: 500 })).allowed).toBe(false);
    expect(checkQuickScan(ctx('pro', { quickScansUsed: 1999 })).allowed).toBe(true);
    expect(checkQuickScan(ctx('pro', { quickScansUsed: 2000 })).allowed).toBe(false);
  });
});

describe('AI grade check gate', () => {
  it('denies free and collector with a Pro recommendation (subscription_required)', () => {
    for (const plan of ['free', 'collector'] as const) {
      const r = checkGradeScan(ctx(plan));
      expect(r.allowed).toBe(false);
      if (!r.allowed) {
        expect(r.reason).toBe('subscription_required');
        expect(r.paywall.recommendedPlan).toBe('pro');
        expect(r.message).toMatch(/Pro/);
      }
    }
  });

  it('allows pro up to 30 and reports the reset on exhaustion', () => {
    expect(checkGradeScan(ctx('pro', { gradeScansUsed: 29 })).allowed).toBe(true);
    const r = checkGradeScan(ctx('pro', { gradeScansUsed: 30 }));
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toBe('usage_limit_reached');
      expect(r.message).toMatch(/resets/i);
    }
  });
});

describe('alerts gate', () => {
  it('free has none; collector 25; pro 250', () => {
    const free = checkAlertCreate(ctx('free'));
    expect(free.allowed).toBe(false);
    if (!free.allowed) expect(free.reason).toBe('subscription_required');

    expect(checkAlertCreate(ctx('collector', { activeAlerts: 24 })).allowed).toBe(true);
    const col = checkAlertCreate(ctx('collector', { activeAlerts: 25 }));
    expect(col.allowed).toBe(false);
    if (!col.allowed) expect(col.paywall.recommendedPlan).toBe('pro');

    expect(checkAlertCreate(ctx('pro', { activeAlerts: 249 })).allowed).toBe(true);
    expect(checkAlertCreate(ctx('pro', { activeAlerts: 250 })).allowed).toBe(false);
  });
});

describe('collection gate', () => {
  it('free caps at 100 with data-preservation messaging', () => {
    expect(checkCollectionAdd(ctx('free', { collectionItems: 99 })).allowed).toBe(true);
    const r = checkCollectionAdd(ctx('free', { collectionItems: 100 }));
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.paywall.recommendedPlan).toBe('collector');
      expect(r.message).toMatch(/existing cards stay/i);
    }
  });

  it('an over-limit legacy collection stays viewable but blocked from adds', () => {
    // e.g. a user who had 150 cards before limits existed, now on Free.
    const r = checkCollectionAdd(ctx('free', { collectionItems: 150 }));
    expect(r.allowed).toBe(false); // add blocked — nothing implies deletion
  });

  it('paid plans are unlimited', () => {
    expect(checkCollectionAdd(ctx('collector', { collectionItems: 10_000 })).allowed).toBe(true);
    expect(checkCollectionAdd(ctx('pro', { collectionItems: 10_000 })).allowed).toBe(true);
  });
});

describe('export gate', () => {
  it('free is denied; collector and pro allowed', () => {
    const r = checkExport(ctx('free'));
    expect(r.allowed).toBe(false);
    expect(checkExport(ctx('collector')).allowed).toBe(true);
    expect(checkExport(ctx('pro')).allowed).toBe(true);
  });
});
