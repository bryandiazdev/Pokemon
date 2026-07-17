import { describe, expect, it } from 'vitest';
import { createCatalogOcrRecognition, stringSimilarity, scoreCandidate } from './catalog-ocr-recognition';
import type { CardCatalogProvider, NormalizedCard } from '../interfaces';

const card = (overrides: Partial<NormalizedCard>): NormalizedCard => ({
  externalId: 'base1-4',
  provider: 'test',
  setExternalId: 'base1',
  name: 'Charizard',
  number: '4',
  printedNumber: '4/102',
  rarity: null,
  supertype: null,
  subtypes: [],
  language: 'en',
  artist: null,
  regulationMark: null,
  imageSmallUrl: 'https://img.example/base1-4/low.webp',
  imageLargeUrl: 'https://img.example/base1-4/high.webp',
  ...overrides,
});

const catalogWith = (cards: NormalizedCard[]): CardCatalogProvider => ({
  name: 'test-catalog',
  async searchCards() {
    return { cards, nextCursor: null };
  },
  async getCard() {
    return cards[0]!;
  },
  async getSet() {
    throw new Error('not used');
  },
  async listSets() {
    return [];
  },
});

describe('catalog-ocr recognition', () => {
  it('carries catalog artwork on candidates for visual confirmation', async () => {
    const provider = createCatalogOcrRecognition(catalogWith([card({})]));
    const result = await provider.identifyCard({
      imageRef: 'data:image/jpeg;base64,x',
      ocr: { name: 'Charizard', number: '4' },
    });
    expect(result.candidates[0]?.imageSmallUrl).toBe('https://img.example/base1-4/low.webp');
    expect(result.candidates[0]?.imageLargeUrl).toBe('https://img.example/base1-4/high.webp');
  });

  it('matches zero-padded printed numbers against unpadded catalog numbers', () => {
    const scored = scoreCandidate(card({ number: '58' }), { name: 'Onix', number: '058' });
    expect(scored.evidence.numberMatch).toBe(true);
  });

  it('matches zero-padded lettered numbers', () => {
    const scored = scoreCandidate(card({ number: 'GG4' }), { name: 'Pikachu', number: 'GG04' });
    expect(scored.evidence.numberMatch).toBe(true);
  });

  it('similarity is symmetric-ish and forgiving of case/punctuation', () => {
    expect(stringSimilarity("Farfetch'd", 'farfetch d')).toBeGreaterThan(0.8);
    expect(stringSimilarity('Charizard', 'Blastoise')).toBeLessThan(0.3);
  });
});
