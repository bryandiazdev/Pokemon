import { describe, expect, it } from 'vitest';
import type { NormalizedSet } from '@psr/providers';
import { matchSets } from './catalog-match';

const SETS: NormalizedSet[] = [
  {
    externalId: 'base1',
    provider: 'demo',
    name: 'Base Set',
    series: 'Original',
    language: 'en',
    printedTotal: 102,
    total: 102,
    releaseDate: '1999-01-09',
    symbolUrl: null,
    logoUrl: null,
  },
  {
    externalId: 'sv4pt5',
    provider: 'demo',
    name: 'Paldean Fates',
    series: 'Scarlet & Violet',
    language: 'en',
    printedTotal: 91,
    total: 245,
    releaseDate: '2024-01-26',
    symbolUrl: null,
    logoUrl: null,
  },
];

describe('matchSets', () => {
  it('returns all sets for an empty query', () => {
    expect(matchSets(SETS, '')).toHaveLength(2);
  });

  it('matches by name', () => {
    expect(matchSets(SETS, 'base').map((s) => s.externalId)).toEqual(['base1']);
  });

  it('matches by series', () => {
    expect(matchSets(SETS, 'scarlet').map((s) => s.externalId)).toEqual(['sv4pt5']);
  });

  it('matches by year', () => {
    expect(matchSets(SETS, '1999').map((s) => s.externalId)).toEqual(['base1']);
  });
});
