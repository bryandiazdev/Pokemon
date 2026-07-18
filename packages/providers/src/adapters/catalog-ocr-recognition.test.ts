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

  it('boosts candidates from the resolved set', () => {
    const inSet = scoreCandidate(
      card({ setExternalId: 'base1' }),
      { name: 'Charizard', number: '4' },
      undefined,
      'base1',
    );
    const outOfSet = scoreCandidate(
      card({ setExternalId: 'base4' }),
      { name: 'Charizard', number: '4' },
      undefined,
      'base1',
    );
    expect(inSet.evidence.setMatch).toBe(true);
    expect(inSet.score).toBeGreaterThan(outOfSet.score);
  });

  it('falls back to an unscoped search when the set-scoped search is empty', async () => {
    const calls: Array<{ query: string; setExternalId?: string }> = [];
    const catalog: CardCatalogProvider = {
      name: 'test-catalog',
      async searchCards(input) {
        calls.push({ query: input.query, setExternalId: input.setExternalId });
        // Empty when scoped to the (wrong) set; hits when unscoped.
        return { cards: input.setExternalId ? [] : [card({})], nextCursor: null };
      },
      async getCard() {
        return card({});
      },
      async getSet() {
        throw new Error('not used');
      },
      async listSets() {
        return [];
      },
    };
    const provider = createCatalogOcrRecognition(catalog);
    const result = await provider.identifyCard({
      imageRef: 'data:image/jpeg;base64,x',
      ocr: { name: 'Charizard', number: '4' },
      setExternalId: 'wrong-set',
    });
    expect(calls[0]?.setExternalId).toBe('wrong-set');
    expect(calls[1]?.setExternalId).toBeUndefined();
    expect(result.candidates).toHaveLength(1);
  });

  it('returns no candidates instead of unrelated catalog noise on a number-only query', async () => {
    // A number-only search can only page through the raw catalog — cards
    // that match neither name nor number must not surface as candidates.
    const unrelated = [
      card({ externalId: 'exu-1', name: 'Unown', number: '!' }),
      card({ externalId: 'exu-2', name: 'Unown', number: '?' }),
    ];
    const provider = createCatalogOcrRecognition(catalogWith(unrelated));
    const result = await provider.identifyCard({
      imageRef: 'data:image/jpeg;base64,x',
      ocr: { number: '35' },
    });
    expect(result.candidates).toHaveLength(0);
    expect(result.requiresConfirmation).toBe(true);
  });

  it('retries with the longest name word when the full name finds nothing', async () => {
    const calls: string[] = [];
    const catalog: CardCatalogProvider = {
      name: 'test-catalog',
      async searchCards(input) {
        calls.push(input.query);
        // The misread suffix kills the full-name query; the bare Pokémon
        // name succeeds.
        return input.query.startsWith('Charizard cx')
          ? { cards: [], nextCursor: null }
          : { cards: [card({})], nextCursor: null };
      },
      async getCard() {
        return card({});
      },
      async getSet() {
        throw new Error('not used');
      },
      async listSets() {
        return [];
      },
    };
    const provider = createCatalogOcrRecognition(catalog);
    const result = await provider.identifyCard({
      imageRef: 'data:image/jpeg;base64,x',
      ocr: { name: 'Charizard cx', number: '4' },
    });
    expect(calls).toEqual(['Charizard cx 4', 'Charizard 4']);
    expect(result.candidates).toHaveLength(1);
  });
});
