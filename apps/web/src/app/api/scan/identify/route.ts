import { z } from 'zod';
import type { NormalizedSet } from '@psr/providers';
import { jsonOk, jsonError, jsonPaywall, withErrorHandling, parse } from '@/lib/api';
import { getRegistry } from '@/lib/providers';
import { matchSets } from '@/lib/catalog-match';
import {
  getEntitlementContext,
  checkQuickScan,
  consumeUsage,
  releaseUsage,
} from '@/lib/services/entitlements';
import { hasVisionScan, identifyCardWithVision, type ScanImage } from '@/lib/services/scan-llm';

const metric = z.number().min(0).max(1).optional();

const bodySchema = z.object({
  // The captured photo as a compressed data URL (analyzed in-memory, never
  // stored), or the literal "camera" from clients that only send OCR hints.
  imageRef: z.string().min(1).max(4_000_000),
  // Optional enlarged crop of the card's bottom strip — the tiny collector
  // number lives there and a dedicated crop reads far better than the full
  // frame at vision-model tile resolution.
  numberCrop: z.string().max(2_000_000).optional(),
  // On-device OCR text (name/number) extracted from the photo by the scanner.
  ocr: z
    .object({
      name: z.string().max(120).optional(),
      number: z.string().max(24).optional(),
      setName: z.string().max(120).optional(),
      rawText: z.string().max(4000).optional(),
    })
    .optional(),
  // Client-computed quality metrics; each optional — clients send only what
  // they actually measured. The server re-decides acceptance.
  quality: z
    .object({
      blur: metric,
      glare: metric,
      coverage: metric,
      brightness: metric,
    })
    .optional(),
});

const CONFIDENCE_THRESHOLD = 0.75;

const isImageDataUrl = (ref: string): boolean => /^data:image\/[a-z+.-]+;base64,/i.test(ref);

// Set catalog cache for set-name resolution — sets change rarely.
let setsCache: { at: number; sets: NormalizedSet[] } | null = null;
const SETS_TTL_MS = 10 * 60_000;

async function listSetsCached(): Promise<NormalizedSet[]> {
  if (setsCache && Date.now() - setsCache.at < SETS_TTL_MS) return setsCache.sets;
  const sets = await getRegistry().call('catalog', 'listSets', (a) => a.listSets({}));
  setsCache = { at: Date.now(), sets };
  return sets;
}

/**
 * Resolve the printed set to a catalog set id using the set name and/or the
 * printed total ("4/102" → 102). Returns undefined rather than guessing:
 * name matches are validated against the total when both are available.
 */
async function resolveSetExternalId(
  setName: string | null,
  setTotal: string | null,
): Promise<string | undefined> {
  if (!setName && !setTotal) return undefined;
  let sets: NormalizedSet[];
  try {
    sets = await listSetsCached();
  } catch {
    return undefined; // set scoping is an optimization, never a failure source
  }
  const total = setTotal ? parseInt(setTotal, 10) : NaN;

  if (setName) {
    const matches = matchSets(sets, setName);
    if (matches.length === 0) return undefined;
    if (!Number.isNaN(total)) {
      const confirmed = matches.find((s) => s.printedTotal === total || s.total === total);
      if (confirmed) return confirmed.externalId;
    }
    return matches[0]!.externalId;
  }

  // Total only: use it when it identifies exactly one set — otherwise it's
  // ambiguous (many sets share a printed total) and we skip scoping.
  const byTotal = sets.filter((s) => s.printedTotal === total || s.total === total);
  return byTotal.length === 1 ? byTotal[0]!.externalId : undefined;
}

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  // Server-side usage gate BEFORE any (potentially paid) provider call.
  const ctx = await getEntitlementContext();
  const gate = checkQuickScan(ctx);
  if (!gate.allowed) {
    return jsonPaywall(gate);
  }

  const visionAvailable = hasVisionScan();

  // Server re-validates image quality; poor images are rejected with guidance.
  // Only when vision is unavailable: the heuristics run on flat-background
  // phone photos with real false-positive rates, and a vision model judges
  // actual legibility far better than a Laplacian variance ever will.
  const q = parsed.value.quality;
  if (q && !visionAvailable) {
    const issues: string[] = [];
    if (q.blur !== undefined && q.blur > 0.6)
      issues.push('The image looks blurry — hold steady and refocus.');
    if (q.glare !== undefined && q.glare > 0.5)
      issues.push('Glare is hiding part of the card — reduce direct light.');
    if (q.coverage !== undefined && q.coverage < 0.4)
      issues.push('Move closer so the card fills the frame.');
    if (q.brightness !== undefined && q.brightness < 0.2)
      issues.push('Too dark — use brighter indirect light.');
    if (q.brightness !== undefined && q.brightness > 0.95)
      issues.push('Overexposed — reduce lighting.');
    if (issues.length > 0) {
      return jsonError('image_rejected', issues.join(' '));
    }
  }

  // Metering: RESERVE one scan atomically before the (paid) vision work — a
  // conditional UPDATE, so concurrent requests can't race past the limit.
  // Any request that reaches the pipeline consumes the scan (the AI cost is
  // incurred even when no card matches); we REFUND only when OUR provider
  // fails, never for user-side photo problems that were already screened.
  const consumed = await consumeUsage(ctx, 'quick_scan');
  if (!consumed.allowed) {
    return jsonPaywall({
      reason: 'usage_limit_reached',
      message: `You've used all ${consumed.limit} scans this month.`,
      paywall: {
        plan: ctx.entitlements.plan,
        metric: 'quick_scan',
        used: consumed.current,
        limit: consumed.limit,
        recommendedPlan: ctx.entitlements.plan === 'free' ? 'collector' : 'pro',
      },
    });
  }

  // Start from on-device OCR hints, then upgrade with server vision when
  // available — Tesseract routinely misreads stylized names on holo foil,
  // while a vision model reads them reliably.
  const ocr: { name?: string; number?: string; setName?: string; rawText?: string } = {
    ...parsed.value.ocr,
  };
  let identifiedBy: 'device-ocr' | 'vision' = 'device-ocr';
  let visionLanguage: string | undefined;
  let setTotal: string | null = null;
  let visionError: string | null = null;

  if (visionAvailable && isImageDataUrl(parsed.value.imageRef)) {
    try {
      const images: ScanImage[] = [{ label: 'full card', dataUrl: parsed.value.imageRef }];
      if (parsed.value.numberCrop && isImageDataUrl(parsed.value.numberCrop)) {
        images.push({
          label: 'enlarged bottom strip of the same card (collector number is here)',
          dataUrl: parsed.value.numberCrop,
        });
      }
      const vision = await identifyCardWithVision(images);
      if (vision === null) {
        return jsonError(
          'image_rejected',
          "That doesn't look like a Pokémon card. Center one card in the frame and try again.",
        );
      }
      if (vision.name || vision.number) {
        // Vision hints win; device OCR fills any gaps.
        if (vision.name) ocr.name = vision.name;
        if (vision.number) ocr.number = vision.number;
        if (vision.setName) ocr.setName = vision.setName;
        if (vision.language) {
          // The vision model emits ISO 639-1; TCGdex uses dialect-scoped
          // catalogs for Chinese and plain codes elsewhere.
          const langMap: Record<string, string> = { zh: 'zh-cn', 'pt-br': 'pt' };
          visionLanguage = langMap[vision.language] ?? vision.language;
        }
        setTotal = vision.setTotal;
        identifiedBy = 'vision';
      }
    } catch (err) {
      // Fall back to on-device OCR hints, but REMEMBER why vision failed —
      // blaming the user's photo for a server-side failure sends them into a
      // hopeless retake loop.
      visionError = err instanceof Error ? err.message : 'Vision analysis failed.';
      // eslint-disable-next-line no-console
      console.error('[scan/identify] vision identification failed:', err);
    }
  }

  if (!ocr.name && !ocr.number) {
    if (visionError) {
      // OUR provider failed — refund the reserved scan.
      await releaseUsage(ctx, 'quick_scan');
      return jsonError('internal_error', `Card identification is unavailable: ${visionError}`);
    }
    return jsonError(
      'image_rejected',
      visionAvailable
        ? 'Could not read the card name or number. Retake with the card flat, filling the frame, in bright indirect light.'
        : 'Could not read the card with on-device OCR, and server vision is not configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY for reliable scans). Retake with the card flat and well lit, or search manually.',
    );
  }

  const setExternalId = await resolveSetExternalId(ocr.setName ?? null, setTotal);

  const result = await getRegistry().call('recognition', 'identifyCard', (a) =>
    a.identifyCard({
      imageRef: parsed.value.imageRef,
      ocr,
      language: visionLanguage,
      setExternalId,
    }),
  );

  const top = result.candidates[0];
  const requiresConfirmation =
    result.requiresConfirmation || !top || top.confidence < CONFIDENCE_THRESHOLD;

  return jsonOk({
    candidates: result.candidates,
    requiresConfirmation,
    remaining: consumed.remaining,
    identifiedBy,
    visionAvailable,
    // Vision failed but device OCR produced *something* — flag that the
    // results rest on weak hints so the UI can warn instead of feigning
    // confidence over garbage.
    visionNote: visionError ? `Server vision failed: ${visionError}` : null,
    readText: { name: ocr.name ?? null, number: ocr.number ?? null },
  });
});
