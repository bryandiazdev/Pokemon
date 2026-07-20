import 'server-only';
import { DEMO_COLLECTION_ITEMS } from '@psr/testing';
import { getRegistry } from '../providers';
import { toUsdPrices } from './fx';
import { getCard as getCatalogCard } from './catalog';
import { getCurrentUser } from '../auth';
import { listCollectionItems, type CollectionItemRow } from './collection';
import {
  money,
  addMoney,
  subMoney,
  mulMoney,
  zeroMoney,
  pctChange,
  type Money,
  type RawCondition,
  type GradingCompany,
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
  imageUrl: string | null;
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

interface ValuationInput {
  id: string;
  cardExternalId: string | null;
  name: string;
  imageUrl: string | null;
  quantity: number;
  ownershipType: 'raw' | 'graded';
  rawCondition?: RawCondition | null;
  gradingCompany?: GradingCompany | null;
  grade?: string | null;
  purchasePriceMinor: number;
  gradeLabel: string | null;
}

async function unitValueFor(item: ValuationInput): Promise<Money> {
  if (!item.cardExternalId) return money(0, CURRENCY);
  const registry = getRegistry();
  try {
    if (item.ownershipType === 'graded' && item.gradingCompany && item.grade) {
      const graded = await registry.call(
        'gradedPricing',
        'getCurrentGradedPrices',
        (a) =>
          a.getCurrentGradedPrices({
            cardExternalId: item.cardExternalId!,
            gradingCompany: item.gradingCompany!,
          }),
        // Cached: dashboards, collection, and shared pages all revalue the
        // same cards; 15 min staleness is fine for display values.
        {
          key: `value:graded:${item.cardExternalId}:${item.gradingCompany}`,
          ttlSeconds: 900,
        },
      );
      const match = graded.find((g) => g.grade === item.grade) ?? graded[0];
      return money(match?.valueMinor ?? 0, CURRENCY);
    }
    const rawNative = await registry.call(
      'rawPricing',
      'getCurrentRawPrices',
      (a) => a.getCurrentRawPrices({ cardExternalId: item.cardExternalId! }),
      { key: `value:raw:${item.cardExternalId}`, ttlSeconds: 900 },
    );
    // USD-only app: convert any EUR (Cardmarket) entries before selection so
    // mixed-currency money math can never throw here again.
    const raw = await toUsdPrices(rawNative);
    // Prefer a native-USD (TCGplayer) market price for the requested condition.
    const native = raw.filter((r) => !r.fxConverted);
    const pool = native.length > 0 ? native : raw;
    const match =
      pool.find((r) => r.condition === (item.rawCondition ?? 'near_mint')) ??
      pool.find((r) => r.condition === 'near_mint') ??
      pool[0];
    return money(match?.valueMinor ?? 0, CURRENCY);
  } catch {
    // Provider hiccup: value at zero rather than failing the whole dashboard.
    return money(0, CURRENCY);
  }
}

async function valueItems(inputs: ValuationInput[]): Promise<ValuedItem[]> {
  const valued: ValuedItem[] = [];
  for (const item of inputs) {
    // One bad item must never take down the whole collection page — value it
    // at zero and keep going.
    try {
      const unit = await unitValueFor(item);
      const line = mulMoney(unit, item.quantity);
      const cost = money(item.purchasePriceMinor * item.quantity, CURRENCY);
      valued.push({
        id: item.id,
        cardExternalId: item.cardExternalId ?? '',
        name: item.name,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        ownershipType: item.ownershipType,
        gradeLabel: item.gradeLabel,
        unitValue: unit,
        lineValue: line,
        costBasis: cost,
        gain: subMoney(line, cost),
        gainPct: pctChange(cost, line),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[portfolio] failed to value item ${item.id}:`, err);
      const zero = money(0, CURRENCY);
      const cost = money(
        Number.isInteger(item.purchasePriceMinor * item.quantity)
          ? item.purchasePriceMinor * item.quantity
          : 0,
        CURRENCY,
      );
      valued.push({
        id: item.id,
        cardExternalId: item.cardExternalId ?? '',
        name: item.name,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        ownershipType: item.ownershipType,
        gradeLabel: item.gradeLabel,
        unitValue: zero,
        lineValue: zero,
        costBasis: cost,
        gain: subMoney(zero, cost),
        gainPct: null,
      });
    }
  }
  return valued;
}

/** Map a collection row to a valuation input (shared by live + shared views). */
function rowToInput(i: CollectionItemRow): ValuationInput {
  return {
    id: i.id,
    cardExternalId: i.cardExternalId,
    name: i.setName ? `${i.name} — ${i.setName}` : i.name,
    imageUrl: i.imageUrl,
    quantity: i.quantity,
    ownershipType: i.ownershipType,
    rawCondition: i.rawCondition,
    gradingCompany: i.gradingCompany,
    grade: i.grade,
    purchasePriceMinor: i.purchasePriceMinor,
    gradeLabel:
      i.ownershipType === 'graded'
        ? `${i.gradingCompany?.toUpperCase() ?? ''} ${i.grade ?? ''}`.trim()
        : i.rawCondition
          ? conditionLabel(i.rawCondition)
          : null,
  };
}

/** Live inputs from the signed-in user's real collection_items. */
async function liveInputs(userId: string): Promise<ValuationInput[]> {
  const items = await listCollectionItems(userId);
  return items.map(rowToInput);
}

/**
 * Value arbitrary collection rows at current market prices (used by the
 * public shared-collection page). Purchase data on the rows is expected to be
 * zeroed by the caller for public views — only market values leave this path.
 */
export async function valueCollectionRows(rows: CollectionItemRow[]): Promise<ValuedItem[]> {
  return valueItems(rows.map(rowToInput));
}

/** Demo inputs from the seeded fixtures. */
function demoInputs(): ValuationInput[] {
  return DEMO_COLLECTION_ITEMS.map((item) => ({
    id: item.id,
    cardExternalId: item.cardExternalId,
    name: cardName(item.cardExternalId),
    imageUrl: null,
    quantity: item.quantity,
    ownershipType: item.ownershipType,
    rawCondition: 'rawCondition' in item ? item.rawCondition : null,
    gradingCompany: 'gradingCompany' in item ? item.gradingCompany : null,
    grade: 'grade' in item ? item.grade : null,
    purchasePriceMinor: item.purchasePriceMinor,
    gradeLabel:
      item.ownershipType === 'graded' && 'gradingCompany' in item
        ? `${item.gradingCompany?.toUpperCase()} ${item.grade}`
        : 'rawCondition' in item
          ? conditionLabel(item.rawCondition)
          : null,
  }));
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const user = await getCurrentUser();
  const live = Boolean(user && !user.isDemo);
  let inputs: ValuationInput[];
  try {
    inputs = live ? await liveInputs(user!.id) : demoInputs();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[portfolio] falling back to demo inputs:', err);
    inputs = demoInputs();
  }
  // Backfill missing artwork from the (cached) catalog so the collection grid
  // has images even for demo items or rows persisted before images were stored.
  for (const input of inputs) {
    if (input.imageUrl || !input.cardExternalId) continue;
    try {
      const card = await getCatalogCard(input.cardExternalId);
      input.imageUrl = card.imageSmallUrl ?? card.imageLargeUrl ?? null;
    } catch {
      // no artwork available — the grid shows a placeholder
    }
  }
  const valued = await valueItems(inputs);
  const freshness: PortfolioSummary['freshness'] = live ? 'live' : 'demo';

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
    freshness,
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
