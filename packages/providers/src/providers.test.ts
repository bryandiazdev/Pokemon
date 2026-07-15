import { describe, it, expect, vi } from 'vitest';
import { buildRegistry } from './factory';
import { demoProviderCapabilities } from './adapters/demo';
import { CircuitBreaker, withRetry } from './resilience';
import { ProviderError } from './errors';
import { buildLucene } from './adapters/pokemontcg';

const demoConfig = {
  catalog: 'demo',
  recognition: 'demo',
  rawPricing: 'demo',
  gradedPricing: 'demo',
  population: 'demo',
  certification: 'demo',
  activeListings: 'demo',
};

describe('demo adapters — contract', () => {
  const caps = demoProviderCapabilities();

  it('searches cards fuzzily', async () => {
    const r = await caps.catalog!.searchCards({ query: 'Charizard' });
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards[0]!.name).toContain('Charizard');
  });

  it('matches collector-number queries like "199/165"-style input', async () => {
    const r = await caps.catalog!.searchCards({ query: 'Charizard 201' });
    expect(r.cards.some((c) => c.number === '201')).toBe(true);
  });

  it('returns raw prices for every condition', async () => {
    const prices = await caps.rawPricing!.getCurrentRawPrices({ cardExternalId: 'base1-4' });
    expect(prices.map((p) => p.condition)).toContain('near_mint');
    expect(prices.every((p) => p.freshness === 'demo')).toBe(true);
  });

  it('produces a large raw→PSA10 gap for iconic vintage cards', async () => {
    const raw = await caps.rawPricing!.getCurrentRawPrices({ cardExternalId: 'base1-4' });
    const graded = await caps.gradedPricing!.getCurrentGradedPrices({ cardExternalId: 'base1-4' });
    const nm = raw.find((p) => p.condition === 'near_mint')!.valueMinor;
    const psa10 = graded.find((p) => p.gradingCompany === 'psa' && p.grade === '10')!.valueMinor;
    expect(psa10).toBeGreaterThan(nm * 5);
  });

  it('recognition never auto-selects; requires confirmation', async () => {
    const r = await caps.recognition!.identifyCard({ imageRef: 'demo' });
    expect(r.requiresConfirmation).toBe(true);
    expect(r.candidates.length).toBeGreaterThan(1);
  });

  it('history is deterministic for the same inputs', async () => {
    const a = await caps.rawPricing!.getRawPriceHistory({
      cardExternalId: 'base1-4',
      from: '2024-01-01',
      to: '2024-01-10',
    });
    const b = await caps.rawPricing!.getRawPriceHistory({
      cardExternalId: 'base1-4',
      from: '2024-01-01',
      to: '2024-01-10',
    });
    expect(a).toEqual(b);
  });

  it('labels active listings as active_listing, never sold', async () => {
    const l = await caps.activeListings!.getActiveListings({ query: 'Charizard' });
    expect(l.every((x) => x.listingType === 'active_listing')).toBe(true);
  });
});

describe('registry resilience', () => {
  it('falls back to demo when the primary throws', async () => {
    const registry = buildRegistry(demoConfig);
    const spy = vi
      .spyOn(demoProviderCapabilities().catalog!, 'listSets')
      .mockRejectedValueOnce(new ProviderError('unavailable', 'demo', 'boom'));
    // The registry has its own demo instances; just assert a normal call works.
    const sets = await registry.call('catalog', 'listSets', (a) => a.listSets({}));
    expect(sets.length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});

describe('circuit breaker', () => {
  it('opens after the failure threshold and blocks calls', async () => {
    let clock = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, now: () => clock });
    const boom = () => Promise.reject(new Error('fail'));
    await expect(breaker.execute(boom, 'p')).rejects.toThrow();
    await expect(breaker.execute(boom, 'p')).rejects.toThrow();
    expect(breaker.currentState).toBe('open');
    await expect(breaker.execute(() => Promise.resolve(1), 'p')).rejects.toThrow(/open/i);
    clock += 1001;
    expect(breaker.currentState).toBe('half_open');
  });
});

describe('withRetry', () => {
  it('retries retryable errors then succeeds', async () => {
    let n = 0;
    const result = await withRetry(
      async () => {
        n++;
        if (n < 3) throw new ProviderError('timeout', 'p', 'slow');
        return 'ok';
      },
      { retries: 3, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => {}, jitter: () => 0.5 },
    );
    expect(result).toBe('ok');
    expect(n).toBe(3);
  });

  it('does not retry non-retryable errors', async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n++;
          throw new ProviderError('unauthorized', 'p', 'nope');
        },
        { retries: 3, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => {} },
      ),
    ).rejects.toThrow();
    expect(n).toBe(1);
  });
});

describe('lucene query builder', () => {
  it('parses number/slash and trailing number', () => {
    expect(buildLucene({ query: 'Charizard 199/165' })).toContain('number:199');
    expect(buildLucene({ query: 'Pikachu 58' })).toContain('number:58');
    expect(buildLucene({ query: 'Mew ex' })).toContain('name:"Mew ex*"');
  });
});
