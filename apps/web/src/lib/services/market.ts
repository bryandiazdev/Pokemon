import 'server-only';
import { getRegistry } from '../providers';
import { listSets, getSet, getCardsInSet } from './catalog';
import { toUsdPoints } from './fx';
import type { NormalizedCard, NormalizedPricePoint } from '@psr/providers';
import type { DataFreshness } from '@psr/types';

/**
 * Market movers — real implementation over the live catalog + pricing.
 *
 * There is no bulk pricing endpoint, so the universe must be bounded: we track
 * the chase cards (secret rares + ex/V/GX-style cards) of the most recent
 * sets, price each via Cardmarket rolling averages (avg30/avg7/avg1/current —
 * genuine provider history, not interpolation), and compute 7-day movement
 * from those. Everything is aggressively cached: per-card history in the
 * registry cache, and the assembled overview in-module, so only the first
 * request after a cold start or TTL expiry pays the fan-out cost.
 */

const RECENT_SETS = 3;
/** Sets smaller than this are promo/side products, not tradeable "market" sets. */
const MIN_SET_SIZE = 40;
const MAX_UNIVERSE = 240;
const CONCURRENCY = 12;
/** Stop starting new price fetches past this budget — serve what we have. */
const FETCH_BUDGET_MS = 8_000;
/** Movers below this current value are noise (a $0.10 common "up 40%"). */
const MIN_MOVER_VALUE_MINOR = 200;
const OVERVIEW_TTL_MS = 30 * 60_000;
const LIST_SIZE = 10;

export interface Mover {
  cardExternalId: string;
  name: string;
  /** Collector number — disambiguates variant printings sharing a name. */
  number: string | null;
  setName: string | null;
  imageUrl: string | null;
  valueMinor: number;
  /** 7-day % change; null when no ~7-day-old observation exists. */
  changePct: number | null;
}

export interface MarketOverview {
  mostValuable: Mover[];
  topGainers: Mover[];
  topDecliners: Mover[];
  setNames: string[];
  updatedAt: string;
  freshness: DataFreshness;
  /** True when the fetch budget expired before the whole universe was priced. */
  truncated: boolean;
}

const EMPTY: MarketOverview = {
  mostValuable: [],
  topGainers: [],
  topDecliners: [],
  setNames: [],
  updatedAt: new Date(0).toISOString(),
  freshness: 'demo',
  truncated: false,
};

/** Chase-card heuristic: secret rares (number past the printed total) and
 * mechanic cards ("… ex", "… VMAX"). These are the cards people actually
 * watch; commons barely move in absolute terms. */
function isChaseCard(card: NormalizedCard, printedTotal: number | null): boolean {
  if (printedTotal) {
    const n = parseInt(card.number ?? '', 10);
    if (Number.isFinite(n) && n > printedTotal) return true;
  }
  return /\s(ex|gx|v|vmax|vstar)$/i.test(card.name);
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>,
  shouldContinue: () => boolean,
): Promise<{ results: R[]; truncated: boolean }> {
  const results: R[] = [];
  let truncated = false;
  let index = 0;
  async function worker() {
    while (index < items.length) {
      if (!shouldContinue()) {
        truncated = truncated || index < items.length;
        return;
      }
      const item = items[index++]!;
      const r = await fn(item);
      if (r !== null) results.push(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return { results, truncated };
}

interface PricedCard {
  card: NormalizedCard;
  setName: string | null;
  valueMinor: number;
  changePct: number | null;
  freshness: DataFreshness;
}

export interface CardPulse {
  valueMinor: number;
  /** 7-day % change; null when no ~7-day-old observation exists. */
  changePct: number | null;
  freshness: DataFreshness;
}

/**
 * Current USD value + 7-day change for one card, from its Cardmarket average
 * history. Shared by the market overview and the watchlist; per-card history
 * is cached, so the two features share one provider fetch. Null = no usable
 * data.
 */
export async function getCardPulse(cardExternalId: string): Promise<CardPulse | null> {
  try {
    const to = new Date();
    const from = new Date(to.getTime() - 31 * 86_400_000);
    const native = await getRegistry().call(
      'rawPricing',
      'getRawPriceHistory',
      (a) =>
        a.getRawPriceHistory({
          cardExternalId,
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
        }),
      { key: `market:hist:${cardExternalId}`, ttlSeconds: 3600 },
    );
    if (native.length === 0) return null;
    const points = (await toUsdPoints(native)).sort((a, b) => a.date.localeCompare(b.date));

    // Current value must be a recent observation, not a month-old average.
    const nowMs = to.getTime();
    const ageDays = (p: NormalizedPricePoint) => (nowMs - new Date(p.date).getTime()) / 86_400_000;
    const current = points[points.length - 1]!;
    if (ageDays(current) > 3) return null;

    // 7-day baseline: the observation nearest 7 days old, within a 5–10 day
    // window. Outside that window the "7-day change" label would be a lie.
    const baseline = points
      .filter((p) => ageDays(p) >= 5 && ageDays(p) <= 10)
      .sort((a, b) => Math.abs(ageDays(a) - 7) - Math.abs(ageDays(b) - 7))[0];
    const changePct =
      baseline && baseline.valueMinor > 0
        ? ((current.valueMinor - baseline.valueMinor) / baseline.valueMinor) * 100
        : null;

    return {
      valueMinor: current.valueMinor,
      changePct,
      freshness: current.freshness ?? 'live',
    };
  } catch {
    // One unpriceable card must never break a page.
    return null;
  }
}

/** Price one card from its Cardmarket average history. Null = no usable data. */
async function priceCard(
  card: NormalizedCard,
  setName: string | null,
): Promise<PricedCard | null> {
  const pulse = await getCardPulse(card.externalId);
  if (!pulse) return null;
  return { card, setName, ...pulse };
}

function toMover(p: PricedCard): Mover {
  return {
    cardExternalId: p.card.externalId,
    name: p.card.name,
    number: p.card.number,
    setName: p.setName,
    imageUrl: p.card.imageSmallUrl,
    valueMinor: p.valueMinor,
    changePct: p.changePct === null ? null : Math.round(p.changePct * 10) / 10,
  };
}

async function computeOverview(): Promise<MarketOverview> {
  const today = new Date().toISOString().slice(0, 10);

  // 1) Universe selection: the most recent full-size sets already released.
  // The set-list endpoint carries no release dates but is ordered oldest →
  // newest, so walk candidates from the tail and confirm the release date via
  // the (cached) set-detail lookup — the tail can contain unreleased sets.
  const allSets = await listSets();
  const bigSets = allSets.filter((s) => (s.total ?? 0) >= MIN_SET_SIZE);
  const pool = bigSets.length > 0 ? bigSets : allSets;
  const recent: typeof allSets = [];
  for (const brief of pool.slice(-10).reverse()) {
    if (recent.length >= RECENT_SETS) break;
    try {
      const full = await getSet(brief.externalId);
      if (full.releaseDate && full.releaseDate > today) continue;
      recent.push(full);
    } catch {
      continue;
    }
  }
  // Tiny catalogs (demo fixtures) may have nothing usable in the tail — show
  // whatever exists rather than an empty page.
  if (recent.length === 0) recent.push(...pool.slice(0, RECENT_SETS));

  const universe: Array<{ card: NormalizedCard; setName: string | null }> = [];
  const seenIds = new Set<string>();
  for (const set of recent) {
    try {
      const cards = await getCardsInSet(set.externalId);
      const chase = cards.filter((c) => isChaseCard(c, set.printedTotal));
      // Chase-heuristic misses everything in small/demo catalogs — fall back
      // to the whole set so the page still has content.
      const picked = chase.length >= 5 ? chase : cards;
      for (const card of picked) {
        if (seenIds.has(card.externalId)) continue;
        seenIds.add(card.externalId);
        universe.push({ card, setName: set.name });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[market] failed to load set', set.externalId, err);
    }
  }
  const bounded = universe.slice(0, MAX_UNIVERSE);

  // 2) Price the universe (bounded fan-out with a hard time budget).
  const startedAt = Date.now();
  const { results: priced, truncated } = await mapPool(
    bounded,
    CONCURRENCY,
    ({ card, setName }) => priceCard(card, setName),
    () => Date.now() - startedAt < FETCH_BUDGET_MS,
  );
  if (truncated || universe.length > bounded.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[market] universe truncated: priced ${priced.length}/${universe.length} cards in ${Date.now() - startedAt}ms`,
    );
  }

  // 3) Rankings.
  const eligible = priced.filter(
    (p) => p.changePct !== null && p.valueMinor >= MIN_MOVER_VALUE_MINOR,
  );
  const freshness: DataFreshness =
    priced.length === 0 ? 'demo' : priced.every((p) => p.freshness === 'demo') ? 'demo' : 'live';

  return {
    mostValuable: [...priced]
      .sort((a, b) => b.valueMinor - a.valueMinor)
      .slice(0, LIST_SIZE)
      .map(toMover),
    topGainers: [...eligible]
      .filter((p) => p.changePct! > 0)
      .sort((a, b) => b.changePct! - a.changePct!)
      .slice(0, LIST_SIZE)
      .map(toMover),
    topDecliners: [...eligible]
      .filter((p) => p.changePct! < 0)
      .sort((a, b) => a.changePct! - b.changePct!)
      .slice(0, LIST_SIZE)
      .map(toMover),
    setNames: recent.map((s) => s.name),
    updatedAt: new Date().toISOString(),
    freshness,
    truncated: truncated || universe.length > bounded.length,
  };
}

// Module-level cache + in-flight dedupe: the fan-out runs at most once per TTL
// per server instance, and concurrent first requests share one computation.
let cached: { at: number; data: MarketOverview } | null = null;
let inflight: Promise<MarketOverview> | null = null;

export async function getMarketOverview(): Promise<MarketOverview> {
  if (cached && Date.now() - cached.at < OVERVIEW_TTL_MS) return cached.data;
  if (inflight) return inflight;
  inflight = computeOverview()
    .then((data) => {
      cached = { at: Date.now(), data };
      return data;
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[market] overview computation failed:', err);
      // Serve the stale overview if we have one; otherwise an empty page.
      return cached?.data ?? EMPTY;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
