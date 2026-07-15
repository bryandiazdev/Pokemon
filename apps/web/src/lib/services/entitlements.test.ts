import { describe, it, expect } from 'vitest';
import {
  checkQuickScan,
  checkGradeScan,
  checkAlertCreate,
  remainingLabel,
  type EntitlementContext,
} from './entitlements';
import { FREE_ENTITLEMENTS, COLLECTOR_PRO_ENTITLEMENTS } from '@psr/config';

function ctx(plan: 'free' | 'collector_pro', usage: Partial<EntitlementContext['usage']> = {}): EntitlementContext {
  return {
    entitlements: plan === 'free' ? FREE_ENTITLEMENTS : COLLECTOR_PRO_ENTITLEMENTS,
    usage: { quickScansUsed: 0, gradeScansUsed: 0, activeAlerts: 0, collectionItems: 0, ...usage },
  };
}

describe('entitlement gates', () => {
  it('allows quick scans under the free limit and blocks at it', () => {
    expect(checkQuickScan(ctx('free', { quickScansUsed: 5 })).allowed).toBe(true);
    const blocked = checkQuickScan(ctx('free', { quickScansUsed: 10 }));
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.reason).toBe('usage_limit_reached');
  });

  it('blocks grade scans past the free monthly cap', () => {
    const r = checkGradeScan(ctx('free', { gradeScansUsed: 1 }));
    expect(r.allowed).toBe(false);
  });

  it('treats Collector Pro collection as unlimited', () => {
    expect(remainingLabel(COLLECTOR_PRO_ENTITLEMENTS.collectionLimit, 9999)).toBe('Unlimited');
  });

  it('caps free alerts and reports entitlement_exceeded', () => {
    const r = checkAlertCreate(ctx('free', { activeAlerts: 3 }));
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('entitlement_exceeded');
  });

  it('reports remaining counts for metered limits', () => {
    const r = checkQuickScan(ctx('collector_pro', { quickScansUsed: 40 }));
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.remaining).toBe(60);
  });
});
