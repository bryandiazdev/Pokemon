import { z } from 'zod';
import { jsonOk, jsonError, jsonPaywall, withErrorHandling, parse } from '@/lib/api';
import { getRegistry } from '@/lib/providers';
import { isImageDataUrl, resolveSetExternalId, mapVisionLanguage } from '@/lib/scan-catalog';
import {
  getEntitlementContext,
  checkBatchScan,
  checkQuickScan,
  consumeUsage,
  releaseUsage,
} from '@/lib/services/entitlements';
import { hasVisionScan, identifyCardsInPhoto, type LlmBatchCard } from '@/lib/services/scan-llm';

/**
 * Batch scanning (Pro): one photo containing MULTIPLE cards. Vision detects
 * and reads every card; each reading is matched against the catalog exactly
 * like a single scan. The client renders a per-card confirmation screen —
 * nothing is added to the collection here.
 *
 * Metering: one quick_scan per card the vision pass detects (that is the real
 * AI cost). One scan is reserved before the vision call and refunded if OUR
 * pipeline fails; after detection the remaining cards are consumed until the
 * quota runs out, and unpaid cards are dropped with an honest notice.
 */

const MAX_BATCH_CARDS = 12;
const CONFIDENCE_THRESHOLD = 0.75;
const MATCH_CONCURRENCY = 4;

const bodySchema = z.object({
  // The batch photo as a compressed data URL (analyzed in-memory, never stored).
  imageRef: z.string().min(1).max(4_500_000),
});

interface BatchCardResult {
  /** Stable index for the client (order = left-to-right, top-to-bottom). */
  index: number;
  read: {
    position: string | null;
    name: string | null;
    number: string | null;
    setName: string | null;
    confidence: number;
  };
  candidates: unknown[];
  requiresConfirmation: boolean;
  note: string | null;
}

async function matchOne(card: LlmBatchCard, index: number): Promise<BatchCardResult> {
  const base = {
    index,
    read: {
      position: card.position,
      name: card.name,
      number: card.number,
      setName: card.setName,
      confidence: card.confidence,
    },
  };
  if (!card.name && !card.number) {
    return {
      ...base,
      candidates: [],
      requiresConfirmation: true,
      note: 'Could not read this card — it may be cut off or blurry.',
    };
  }
  try {
    const setExternalId = await resolveSetExternalId(card.setName, card.setTotal);
    const result = await getRegistry().call('recognition', 'identifyCard', (a) =>
      a.identifyCard({
        imageRef: 'batch',
        ocr: {
          name: card.name ?? undefined,
          number: card.number ?? undefined,
          setName: card.setName ?? undefined,
        },
        language: mapVisionLanguage(card.language),
        setExternalId,
      }),
    );
    const top = result.candidates[0] as { confidence?: number } | undefined;
    return {
      ...base,
      candidates: result.candidates.slice(0, 3),
      requiresConfirmation:
        result.requiresConfirmation || !top || (top.confidence ?? 0) < CONFIDENCE_THRESHOLD,
      note:
        result.candidates.length === 0
          ? `No catalog match for "${card.name ?? card.number}".`
          : null,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[scan/batch] catalog match failed for card', index, err);
    return {
      ...base,
      candidates: [],
      requiresConfirmation: true,
      note: `The catalog is busy — "${card.name ?? card.number}" was read fine, retry in a moment.`,
    };
  }
}

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const ctx = await getEntitlementContext();
  const proGate = checkBatchScan(ctx);
  if (!proGate.allowed) return jsonPaywall(proGate);
  const scanGate = checkQuickScan(ctx);
  if (!scanGate.allowed) return jsonPaywall(scanGate);

  if (!hasVisionScan()) {
    return jsonError(
      'provider_unavailable',
      'Batch scanning needs server vision (set ANTHROPIC_API_KEY or OPENAI_API_KEY).',
    );
  }
  if (!isImageDataUrl(parsed.value.imageRef)) {
    return jsonError('validation_error', 'Send the batch photo as an image data URL.');
  }

  // Reserve ONE scan before the (paid) vision call — refunded only if OUR
  // pipeline fails, mirroring single-scan semantics.
  const first = await consumeUsage(ctx, 'quick_scan');
  if (!first.allowed) {
    return jsonPaywall({
      reason: 'usage_limit_reached',
      message: `You've used all ${first.limit} scans this month.`,
      paywall: {
        plan: ctx.entitlements.plan,
        metric: 'quick_scan',
        used: first.current,
        limit: first.limit,
        recommendedPlan: 'pro',
      },
    });
  }

  let detected: LlmBatchCard[];
  try {
    detected = await identifyCardsInPhoto(
      { label: 'batch photo', dataUrl: parsed.value.imageRef },
      MAX_BATCH_CARDS,
    );
  } catch (err) {
    await releaseUsage(ctx, 'quick_scan');
    const detail = err instanceof Error ? err.message : 'Vision analysis failed.';
    // eslint-disable-next-line no-console
    console.error('[scan/batch] vision failed:', err);
    return jsonError('internal_error', `Batch identification is unavailable: ${detail}`);
  }

  if (detected.length === 0) {
    // The vision call ran (and cost money), but be generous: no cards found
    // is usually a user-fixable photo problem — refund the reserved scan.
    await releaseUsage(ctx, 'quick_scan');
    return jsonError(
      'image_rejected',
      'No Pokémon cards were found in that photo. Lay the cards flat, face up, without overlap, and fill the frame.',
    );
  }

  // Pay for the remaining detected cards (the first is already reserved).
  // Quota can run out mid-batch: process only what was paid for and say so.
  let paid = 1;
  let remaining = first.remaining;
  for (let i = 1; i < detected.length; i++) {
    const consumed = await consumeUsage(ctx, 'quick_scan');
    if (!consumed.allowed) break;
    paid += 1;
    remaining = consumed.remaining;
  }
  const dropped = detected.length - paid;
  const payable = detected.slice(0, paid);

  // Match each reading against the catalog with bounded concurrency.
  const results: BatchCardResult[] = [];
  for (let i = 0; i < payable.length; i += MATCH_CONCURRENCY) {
    const chunk = payable.slice(i, i + MATCH_CONCURRENCY);
    results.push(...(await Promise.all(chunk.map((c, j) => matchOne(c, i + j)))));
  }

  return jsonOk({
    cards: results,
    detectedCount: detected.length,
    consumed: paid,
    remaining,
    notice:
      dropped > 0
        ? `${detected.length} cards were detected but only ${paid} scan${paid === 1 ? '' : 's'} remained this month — the last ${dropped} card${dropped === 1 ? '' : 's'} were not identified.`
        : null,
  });
});
