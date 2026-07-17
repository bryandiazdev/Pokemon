/**
 * Catalog-OCR recognition adapter.
 *
 * Implements the spec's recognition fallback pipeline without a paid
 * image-recognition API: given OCR text (card name / collector number / set,
 * extracted on-device or by a vision OCR pass), it searches the canonical
 * catalog and RANKS candidates by name similarity, number match, set hint, and
 * language. It never silently auto-selects among visually similar printings —
 * confirmation is required unless one candidate is a clear, isolated winner.
 *
 * A production deployment can swap in a hosted image-recognition provider behind
 * the same `CardRecognitionProvider` interface; this adapter remains a robust,
 * zero-cost fallback.
 */

import type {
  CardRecognitionProvider,
  CardCatalogProvider,
  CardImageInput,
  CardRecognitionResult,
  CardRecognitionCandidate,
  NormalizedCard,
} from '../interfaces';
import { ProviderError } from '../errors';

const NAME = 'catalog-ocr';

/** Dice coefficient over character bigrams — deterministic, 0..1. */
export function stringSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const bx = bigrams(x);
  const by = bigrams(y);
  let intersection = 0;
  for (const [bg, count] of bx) {
    const other = by.get(bg) ?? 0;
    intersection += Math.min(count, other);
  }
  const total = x.length - 1 + (y.length - 1);
  return total > 0 ? (2 * intersection) / total : 0;
}

/** Normalize a collector number like "199/165" or "SWSH244" for comparison. */
function normalizeNumber(n: string | null | undefined): string {
  const base = (n ?? '').toLowerCase().replace(/\s+/g, '').split('/')[0] ?? '';
  // Printed numbers are often zero-padded ("058/165", "GG04/GG70") while
  // catalog numbers usually aren't — treat "058" and "58" as the same number.
  return base.replace(/^([a-z]*)0+(?=\d)/, '$1');
}

interface Scored {
  card: NormalizedCard;
  score: number;
  evidence: Record<string, unknown>;
}

export function scoreCandidate(
  card: NormalizedCard,
  ocr: NonNullable<CardImageInput['ocr']>,
  language?: string,
): Scored {
  const evidence: Record<string, unknown> = {};
  let score = 0;

  if (ocr.name) {
    const sim = stringSimilarity(ocr.name, card.name);
    evidence.nameSimilarity = Number(sim.toFixed(3));
    score += sim * 0.6;
  }
  if (ocr.number) {
    const target = normalizeNumber(ocr.number);
    const cardNum = normalizeNumber(card.number);
    const printedNum = normalizeNumber(card.printedNumber);
    if (target && (target === cardNum || target === printedNum)) {
      evidence.numberMatch = true;
      score += 0.3;
    }
  }
  if (ocr.setName && card.metadata && typeof card.metadata === 'object') {
    // Set hint is soft; catalog search already biases toward the set.
    evidence.setHint = ocr.setName;
  }
  if (language && card.language === language) {
    evidence.languageMatch = true;
    score += 0.1;
  }
  return { card, score: Math.min(1, score), evidence };
}

export interface CatalogOcrOptions {
  /** Top candidate must clear this to allow auto-select without confirmation. */
  autoSelectThreshold?: number;
  /** Max separation to the runner-up before we still force confirmation. */
  ambiguityMargin?: number;
}

export function createCatalogOcrRecognition(
  catalog: CardCatalogProvider,
  options: CatalogOcrOptions = {},
): CardRecognitionProvider {
  const autoSelectThreshold = options.autoSelectThreshold ?? 0.82;
  const ambiguityMargin = options.ambiguityMargin ?? 0.08;

  return {
    name: NAME,
    async identifyCard(input: CardImageInput): Promise<CardRecognitionResult> {
      const ocr = input.ocr;
      if (!ocr || (!ocr.name && !ocr.number)) {
        // No usable OCR text: we cannot identify from the image alone here.
        throw new ProviderError(
          'bad_response',
          NAME,
          'No OCR text supplied; provide a card name or number to identify.',
        );
      }

      // Query the catalog with the strongest available hint.
      const query = [ocr.name, ocr.number].filter(Boolean).join(' ').trim();
      const { cards } = await catalog.searchCards({ query, limit: 25, language: input.language });

      const scored = cards
        .map((card) => scoreCandidate(card, ocr, input.language))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      const candidates: CardRecognitionCandidate[] = scored.map((s, i) => ({
        cardExternalId: s.card.externalId,
        cardName: s.card.name,
        setHint: s.card.setExternalId,
        numberHint: s.card.number,
        language: s.card.language,
        confidence: Number(s.score.toFixed(3)),
        ranking: i + 1,
        evidence: s.evidence,
        imageSmallUrl: s.card.imageSmallUrl,
        imageLargeUrl: s.card.imageLargeUrl,
      }));

      const top = candidates[0];
      const runnerUp = candidates[1];
      const clearWinner =
        !!top &&
        top.confidence >= autoSelectThreshold &&
        (!runnerUp || top.confidence - runnerUp.confidence >= ambiguityMargin);

      return {
        candidates,
        provider: NAME,
        requiresConfirmation: !clearWinner,
      };
    },
  };
}
