import 'server-only';
import { DEMO_COLLECTION_ITEMS } from '@psr/testing';
import { getRegistry } from '../providers';
import {
  money,
  addMoney,
  subMoney,
  mulMoney,
  zeroMoney,
  pctChange,
  type Money,
} from '@psr/types';

/**
 * Portfolio valuation. In demo mode this values the seeded demo collection with
 * current fixture prices. In live mode the same shape is produced from the
 * user's `collection_items` joined to the latest `price_points`.
 */

export interface ValuedItem {
  id: string;
  cardExternalId: string;
  name: string;
  quantity: number;
  ownershipType: 'raw' | 'graded';
  gradeLabel: string | null;
  unitValue: Money;
  lineValue: Money;
  costBasis: Money;
  gain: Money;
  gainPct: number | null;
}

export interface PortfolioSummary {
  currency: string;
  totalMarketValue: Money;
  totalCostBasis: Money;
  unrealizedGain: Money;
  unrealizedGainPct: number | null;
  rawValue: Money;
  gradedValue: Money;
  uniqueCards: number;
  totalPhysicalCards: number;
  gradedCount: number;
  rawCount: number;
  items: ValuedItem[];
  freshness: 'demo' | 'snapshot' | 'live';
}

const CURRENCY = 'USD';

async function unitValueFor(item: (typeof DEMO_COLLECTION_ITEMS)[number]): Promise<Money> {
  const registry = getRegistry();
  if (item.ownershipType === 'graded' && item.gradingCompany && item.grade) {
    const graded = await registry.call('gradedPricing', 'getCurrentGradedPrices', (a) =>
      a.getCurrentGradedPrices({ cardExternalId: item.cardExternalId, gradingCompany: item.gradingCompany }),
    );
    const match = graded.find((g) => g.grade === item.grade) ?? graded[0];
    return money(match?.valueMinor ?? 0, CURRENCY);
  }
  const raw = await registry.call('rawPricing', 'getCurrentRawPrices', (a) =>
    a.getCurrentRawPrices({ cardExternalId: item.cardExternalId }),
  );
  const cond = 'rawCondition' in item ? item.rawCondition : 'near_mint';
  const match = raw.find((r) => r.condition === cond) ?? raw.find((r) => r.condition === 'near_mint');
  return money(match?.valueMinor ?? 0, CURRENCY);
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const valued: ValuedItem[] = [];
  for (const item of DEMO_COLLECTION_ITEMS) {
    const unit = await unitValueFor(item);
    const line = mulMoney(unit, item.quantity);
    const cost = money(item.purchasePriceMinor * item.quantity, CURRENCY);
    const gain = subMoney(line, cost);
    valued.push({
      id: item.id,
      cardExternalId: item.cardExternalId,
      name: cardName(item.cardExternalId),
      quantity: item.quantity,
      ownershipType: item.ownershipType,
      gradeLabel:
        item.ownershipType === 'graded' && 'gradingCompany' in item
          ? `${item.gradingCompany?.toUpperCase()} ${item.grade}`
          : ('rawCondition' in item ? conditionLabel(item.rawCondition) : null),
      unitValue: unit,
      lineValue: line,
      costBasis: cost,
      gain,
      gainPct: pctChange(cost, line),
    });
  }

  const zero = zeroMoney(CURRENCY);
  const totalMarketValue = valued.reduce((acc, v) => addMoney(acc, v.lineValue), zero);
  const totalCostBasis = valued.reduce((acc, v) => addMoney(acc, v.costBasis), zero);
  const rawValue = valued
    .filter((v) => v.ownershipType === 'raw')
    .reduce((acc, v) => addMoney(acc, v.lineValue), zero);
  const gradedValue = valued
    .filter((v) => v.ownershipType === 'graded')
    .reduce((acc, v) => addMoney(acc, v.lineValue), zero);

  return {
    currency: CURRENCY,
    totalMarketValue,
    totalCostBasis,
    unrealizedGain: subMoney(totalMarketValue, totalCostBasis),
    unrealizedGainPct: pctChange(totalCostBasis, totalMarketValue),
    rawValue,
    gradedValue,
    uniqueCards: new Set(valued.map((v) => v.cardExternalId)).size,
    totalPhysicalCards: valued.reduce((n, v) => n + v.quantity, 0),
    gradedCount: valued.filter((v) => v.ownershipType === 'graded').reduce((n, v) => n + v.quantity, 0),
    rawCount: valued.filter((v) => v.ownershipType === 'raw').reduce((n, v) => n + v.quantity, 0),
    items: valued,
    freshness: 'demo',
  };
}

/** Deterministic demo portfolio history for the value-over-time chart. */
export async function getPortfolioHistory(days = 90): Promise<{ date: string; valueMinor: number }[]> {
  const summary = await getPortfolioSummary();
  const end = summary.totalMarketValue.minor;
  const points: { date: string; valueMinor: number }[] = [];
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    // Gentle deterministic drift ending at the current value.
    const t = (days - i) / days;
    const wobble = Math.sin(i / 6) * 0.03;
    const value = Math.round(end * (0.8 + 0.2 * t) * (1 + wobble));
    points.push({ date: d.toISOString().slice(0, 10), valueMinor: value });
  }
  return points;
}

function cardName(externalId: string): string {
  const names: Record<string, string> = {
    'base1-4': 'Charizard — Base Set',
    'sv4pt5-193': 'Mew ex — Paldean Fates',
    'base1-58': 'Pikachu — Base Set',
  };
  return names[externalId] ?? externalId;
}

function conditionLabel(c: string): string {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
