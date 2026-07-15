import { formatMoney, money, type Money, type DataFreshness } from '@psr/types';

export function fmtMinor(minor: number, currency = 'USD', locale = 'en-US'): string {
  return formatMoney(money(Math.round(minor), currency), locale);
}

export function fmtMoney(m: Money, locale = 'en-US'): string {
  return formatMoney(m, locale);
}

export function fmtPct(pct: number | null): string {
  if (pct === null || Number.isNaN(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export const FRESHNESS_LABEL: Record<DataFreshness, string> = {
  live: 'Live',
  snapshot: 'Daily snapshot',
  estimated: 'Estimated',
  stale: 'Stale',
  demo: 'Demo data',
};

export function changeTone(delta: number): 'positive' | 'negative' | 'neutral' {
  if (delta > 0) return 'positive';
  if (delta < 0) return 'negative';
  return 'neutral';
}
